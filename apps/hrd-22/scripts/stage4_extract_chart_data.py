"""[단계 4] 정제 DB → 도표 데이터 JSON 자동 산출.

chart_specs.yaml 의 도표 × segment_defs 를 돌며 변수별 집계 → chart_data.json.
집계법은 codebook_22th '응답방식' 텍스트로 자동추론(1차) + chart_specs의 agg/primary_var/formula override.

사용:
  python scripts/stage4_extract_chart_data.py \
      --src 3_cleaned/All_확인완료_21th.xlsx \
      --out 4_aggregated/chart_data_21th.json
"""
from __future__ import annotations
import argparse
import io
import json
import re
import sys
from pathlib import Path

import numpy as np
import openpyxl as op
import pandas as pd
import yaml

if __name__ == "__main__" and sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
SPECS = ROOT / "config/chart_specs.yaml"
SEGMENTS = ROOT / "config/segments.yaml"
CODEBOOK = ROOT / "0_survey/codebook_22th.xlsx"
DEFAULT_SRC = ROOT / "3_cleaned/All_확인완료_21th.xlsx"
DEFAULT_OUT = ROOT / "4_aggregated/chart_data_21th.json"

EMPTY = (None, "", " ", "-", "ㅡ")


# ─────────────────────────────────────────────
# 집계법 자동추론 (응답방식 텍스트 → agg)
# ─────────────────────────────────────────────

def infer_agg(resp_format: str) -> str:
    s = (resp_format or "").strip()
    if s.startswith("숫자(%)"):
        return "mean_pct"
    if s.startswith("1~5점 척도"):
        return "likert"
    if s.startswith("숫자"):
        return "mean"
    if s.startswith("쉼표구분 복수응답"):
        return "multi_rate"
    if s.startswith("순위)"):
        return "rank"
    # 텍스트/메타/형식
    if re.match(r"(텍스트|이메일|전화번호|YYYY|년-월|미사용|완료/미완료|M=)", s):
        return "skip"
    # enum 단일선택: '1=...' 또는 '1~5=...'
    if re.match(r"\s*\d+\s*[=~]", s):
        return "dist"
    return "skip"


def load_codebook_agg() -> dict[str, str]:
    wb = op.load_workbook(CODEBOOK, read_only=True)
    ws = wb.worksheets[0]
    out = {}
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        var = str(r[0]) if r[0] else None
        if var:
            out[var] = infer_agg("" if r[4] is None else str(r[4]))
    wb.close()
    return out


# ─────────────────────────────────────────────
# 모집단 + 세그먼트
# ─────────────────────────────────────────────

def num(s):
    return pd.to_numeric(s, errors="coerce")


def _pop_mask(df: pd.DataFrame, spec: dict, excl_col, excl_val) -> pd.Series:
    m = pd.Series(True, index=df.index)
    if "rdiv_in" in spec:
        m &= num(df["R_Div"]).isin(spec["rdiv_in"])
    for c in spec.get("required_all", []):
        m &= num(df[c]).notna()
    if spec.get("required_any"):
        any_m = pd.Series(False, index=df.index)
        for c in spec["required_any"]:
            any_m |= num(df[c]).notna()
        m &= any_m
    if excl_col and excl_col in df.columns:
        m &= ~(df[excl_col].astype(str).str.lower() == str(excl_val).lower())
    return m


def build_population(df: pd.DataFrame, pf: dict) -> pd.DataFrame:
    """기업 ∪ 공공 모집단 (docs/POPULATION_FILTER_SPEC_22th.md). 세그먼트에서 R_Div로 분기."""
    ec, ev = pf.get("optional_exclusion_column"), pf.get("optional_exclusion_value")
    corp = _pop_mask(df, pf["corporate"], ec, ev)
    pub = _pop_mask(df, pf["public"], ec, ev)
    return df[corp | pub].copy()


def segment_masks(pop: pd.DataFrame, seg_type: str, seg_defs: dict, industry_opts: dict) -> dict[str, pd.Series]:
    emp = num(pop["p1)R_1_2_2"])
    rdiv = num(pop["R_Div"])
    corp = rdiv.isin([1, 2, 3])          # 기업 (주 분석)
    if seg_type == "overall" or seg_type == "top3_only":
        return {"전체": corp}             # 헤드라인 = 기업
    if seg_type == "size_tier":
        return {
            "전체": corp,
            "1000이상": corp & (emp >= 1000),
            "300-999": corp & (emp >= 300) & (emp < 1000),
            "299이하": corp & (emp < 300),
            "공공": rdiv.isin([4, 5]),     # 별도 집계
        }
    if seg_type == "public":
        return {"공공기관": rdiv == 4, "공공기타": rdiv == 5}
    if seg_type == "major_industry":
        defs = seg_defs.get("major_industry", {})
        labels = defs.get("ref_21th", [])
        # R_Cate 코드 → 라벨 (segments.yaml options 역매핑)
        out = {}
        cate = pop["R_Cate"].astype(str).str.strip()
        for lab in labels:
            codes = [k for k, v in industry_opts.items() if v == lab]
            out[lab] = corp & cate.isin(codes)     # 기업 한정
        return out
    return {"전체": pd.Series(True, index=pop.index)}


# ─────────────────────────────────────────────
# 집계 계산
# ─────────────────────────────────────────────

def agg_value(df_s: pd.DataFrame, variables: list[str], agg: str, sub: dict) -> dict:
    if sub.get("formula"):
        return {"formula": sub["formula"], "value": _formula_mean(df_s, sub["formula"])}
    vlist = [sub["primary_var"]] if sub.get("primary_var") else variables
    vlist = [v for v in vlist if v in df_s.columns]
    if not vlist:
        return {"note": "no_variables"}

    if agg == "mean":
        return {v: _safe_mean(df_s[v]) for v in vlist}
    if agg == "mean_pct":
        return _mean_pct(df_s, vlist)
    if agg == "likert":
        return {v: {"mean": _safe_mean(df_s[v]), "dist": _dist(df_s[v], range(1, 6))} for v in vlist}
    if agg == "dist":
        return {v: _dist(df_s[v]) for v in vlist}
    if agg == "multi_rate":
        n = len(df_s)
        return {v: _multi_rate(df_s[v], n) for v in vlist}
    if agg == "rank":
        return {v: _dist(df_s[v]) for v in vlist}   # 순위 분포(간이)
    return {"note": f"agg_skipped:{agg}"}


def _safe_mean(s):
    m = num(s).mean()
    return None if pd.isna(m) else round(float(m), 2)


def _split_pct_groups(variables: list[str]) -> dict:
    """합계 100% 그룹 식별. _etc 등 비숫자 접미사 제외, 현재(_3)/향후(_4) 섞이면 분리."""
    nums = [v for v in variables if v.rsplit("_", 1)[-1].isdigit()]
    suff = {v.rsplit("_", 1)[-1] for v in nums}
    if suff <= {"3", "4"} and {"3", "4"} <= suff:
        return {"현재": [v for v in nums if v.endswith("_3")],
                "향후": [v for v in nums if v.endswith("_4")]}
    return {None: nums}


def _pct_group_means(df_s: pd.DataFrame, gvars: list[str]) -> dict:
    """그룹 일관 분모로 평균 비율. 문항 응답행(그룹합>0) 기준, 빈칸=0% 배분 → 합≈100."""
    gvars = [v for v in gvars if v in df_s.columns]
    if not gvars:
        return {}
    sub = df_s[gvars].apply(lambda c: num(c))
    rowsum = sub.sum(axis=1, min_count=1)
    base = sub[rowsum > 0]
    if len(base) == 0:
        return {v: 0.0 for v in gvars}
    base = base.fillna(0)
    means = {v: round(float(base[v].mean()), 2) for v in gvars}
    means["_base_N"] = int(len(base))
    means["_sum"] = round(sum(base[v].mean() for v in gvars), 1)
    return means


def _mean_pct(df_s: pd.DataFrame, variables: list[str]) -> dict:
    groups = _split_pct_groups(variables)
    if list(groups.keys()) == [None]:
        return _pct_group_means(df_s, groups[None])
    return {g: _pct_group_means(df_s, vs) for g, vs in groups.items()}


def _dist(s, codes=None):
    vals = s[~s.isin(EMPTY)].dropna()
    vals = vals.astype(str).str.strip()
    if len(vals) == 0:
        return {}
    vc = vals.value_counts()
    keys = [str(c) for c in codes] if codes is not None else list(vc.index)
    n = len(vals)
    return {k: round(float(vc.get(k, 0)) / n * 100, 1) for k in keys}


def _multi_rate(s, n):
    if n == 0:
        return {}
    cnt = {}
    for v in s:
        if v in EMPTY or pd.isna(v):
            continue
        for code in re.split(r"[,\s]+", str(v).strip()):
            if code:
                cnt[code] = cnt.get(code, 0) + 1
    return {k: round(v / n * 100, 1) for k, v in sorted(cnt.items())}


def _formula_mean(df_s, formula):
    m = re.match(r"\s*([\w)\(]+)\s*([/\-])\s*([\w)\(]+)\s*", formula)
    if not m:
        return None
    a, op_, b = num(df_s[m.group(1)]), m.group(2), num(df_s[m.group(3)])
    res = (a / b) if op_ == "/" else (a - b)
    res = res.replace([np.inf, -np.inf], np.nan).mean()
    return None if pd.isna(res) else round(float(res), 4)


# ─────────────────────────────────────────────
# main
# ─────────────────────────────────────────────

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--src", type=Path, default=DEFAULT_SRC)
    p.add_argument("--src-sheet", default="Sheet1")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = p.parse_args()

    specs = yaml.safe_load(SPECS.read_text(encoding="utf-8"))
    seg_defs = specs.get("segment_defs", {})
    cb_agg = load_codebook_agg()
    industry_opts = {}
    seg_yaml = yaml.safe_load(SEGMENTS.read_text(encoding="utf-8"))
    for g in seg_yaml.get("column_groups", []):
        if g.get("id") == 1:
            industry_opts = g.get("options", {})

    df = pd.read_excel(args.src, sheet_name=args.src_sheet, dtype=object)
    pop = build_population(df, seg_yaml["population_filter"])
    rdiv = num(pop["R_Div"])
    n_corp = int(rdiv.isin([1, 2, 3]).sum())
    n_pub = int(rdiv.isin([4, 5]).sum())
    print(f"입력 {df.shape} → 모집단 기업 {n_corp} / 공공 {n_pub}")

    out = {"source": args.src.name, "population_N": {"기업": n_corp, "공공": n_pub}, "charts": []}
    skipped = 0
    for ch in specs.get("charts", []):
        for sub in ch.get("subcharts", []):
            variables = sub.get("variables", [])
            agg = sub.get("agg") or (infer_agg_for(variables, cb_agg))
            if agg == "skip" and not sub.get("formula"):
                skipped += 1
                continue
            masks = segment_masks(pop, sub.get("segment", "overall"), seg_defs, industry_opts)
            seg_result = {}
            for sname, mask in masks.items():
                df_s = pop[mask]
                seg_result[sname] = {"N": int(len(df_s)), "agg": agg_value(df_s, variables, agg, sub)}
            out["charts"].append({
                "chart_id": ch.get("id"), "title": ch.get("title"),
                "sub": sub.get("sub_title"), "agg": agg, "segment": sub.get("segment", "overall"),
                "variables": variables, "segments": seg_result,
            })

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"출력: {args.out.name}  도표데이터 {len(out['charts'])}개 (skip {skipped})")
    return 0


def infer_agg_for(variables: list[str], cb_agg: dict[str, str]) -> str:
    for v in variables:
        a = cb_agg.get(v)
        if a and a != "skip":
            return a
    return "skip"


if __name__ == "__main__":
    sys.exit(main() or 0)
