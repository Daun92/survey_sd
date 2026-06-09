"""[단계 3] 정제 결정 엔진 — 분석가 결정을 cleaned DB에 적용.

설계: docs/CURATION_APP_DESIGN.md (§2 식별자, §3 결정 스키마, §7 규칙).
결정 원장(decisions yaml)이 단일 진실원, cleaned DB는 raw+decisions 멱등 파생.

서브명령:
  ingest  : resp_id(행)/org_key(조직) 부여 → resp_id_map csv
  dedup   : 조직 중복 1건 자동추천(완성도→최신) + 검토플래그 → dedup_suggestions csv
  apply   : decisions yaml(correction/exclusion/reclassification) 적용 → cleaned DB

사용:
  python scripts/curation_engine.py ingest --src workspace/21th_cleaned_as22.xlsx
  python scripts/curation_engine.py dedup  --src workspace/21th_cleaned_as22.xlsx
  python scripts/curation_engine.py apply  --src workspace/21th_cleaned_as22.xlsx \
         --decisions config/decisions_21th.yaml --out 3_cleaned/All_확인완료_21th.xlsx
"""
from __future__ import annotations
import argparse
import hashlib
import io
import re
import sys
from pathlib import Path

import pandas as pd
import yaml

if __name__ == "__main__" and sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / "workspace/21th_cleaned_as22.xlsx"
ID_MAP_OUT = ROOT / "workspace/resp_id_map_21th.csv"
DEDUP_OUT = ROOT / "workspace/dedup_suggestions_21th.csv"
DEFAULT_CLEAN_OUT = ROOT / "3_cleaned/All_확인완료_21th.xlsx"

LEGAL_FORMS = ["주식회사", "(주)", "㈜", "유한회사", "재단법인", "사단법인", "(재)", "(사)"]
EMPTY = (None, "", " ", "-", "ㅡ")


def norm_name(v) -> str:
    s = "" if v is None else str(v)
    for lf in LEGAL_FORMS:
        s = s.replace(lf, "")
    return re.sub(r"\s+", "", s).strip()


def load_df(src: Path) -> pd.DataFrame:
    # 어댑터 산출(단일시트) 또는 원본 cleaned 모두 지원
    try:
        return pd.read_excel(src, sheet_name="Sheet1", dtype=object)
    except (ValueError, KeyError):
        return pd.read_excel(src, sheet_name=0, dtype=object)


def assign_ids(df: pd.DataFrame) -> pd.DataFrame:
    """행 순서 기반 resp_id(R%04d) + 원본키 해시 + org_key 부여 (결정론적·멱등)."""
    df = df.drop(columns=[c for c in ("resp_id", "org_key", "src_hash") if c in df.columns])
    biz = df.get("R_Biz_Reg_No")
    name = df.get("R_Name")
    regd = df.get("tesmi_regdate")
    resp_id, org_key, src_hash = [], [], []
    for i in range(len(df)):
        rid = "R%04d" % (i + 1)
        b = "" if biz is None else ("" if biz.iloc[i] in EMPTY else str(biz.iloc[i]).strip())
        nm = "" if name is None else ("" if name.iloc[i] in EMPTY else str(name.iloc[i]).strip())
        rd = "" if regd is None else str(regd.iloc[i])
        h = hashlib.sha1(f"{b}|{nm}|{rd}".encode("utf-8")).hexdigest()[:10]
        ok = b if b else ("name:" + norm_name(nm) if nm else rid)   # 사업자번호>회사명정규화>행
        resp_id.append(rid)
        org_key.append(ok)
        src_hash.append(h)
    out = df.copy()
    out.insert(0, "resp_id", resp_id)
    out.insert(1, "org_key", org_key)
    out.insert(2, "src_hash", src_hash)
    return out


def completeness(df: pd.DataFrame) -> pd.Series:
    pcols = [c for c in df.columns if str(c).startswith("p")]
    return df[pcols].apply(lambda r: sum(1 for v in r if v not in EMPTY and not pd.isna(v)), axis=1)


def cmd_ingest(args):
    df = assign_ids(load_df(args.src))
    ID_MAP_OUT.parent.mkdir(parents=True, exist_ok=True)
    df[["resp_id", "org_key", "src_hash", "R_Company_Name", "R_Biz_Reg_No"]].to_csv(
        ID_MAP_OUT, index=False, encoding="utf-8-sig")
    print(f"ingest: {len(df)}행, resp_id/org_key 부여 → {ID_MAP_OUT.relative_to(ROOT)}")
    print(f"  org_key 고유: {df['org_key'].nunique()} (중복 조직 {len(df) - df['org_key'].nunique()}행 초과분)")


def cmd_dedup(args):
    df = assign_ids(load_df(args.src))
    df["_comp"] = completeness(df)
    rows = []
    for ok, g in df.groupby("org_key"):
        if len(g) == 1:
            continue
        # 완성도 최대 → 동률 시 최신 tesmi_regdate
        g2 = g.sort_values(by=["_comp", "tesmi_regdate"], ascending=[False, False])
        keep = g2.iloc[0]["resp_id"]
        rdiv_conflict = g["R_Div"].astype(str).nunique() > 1
        for _, r in g.iterrows():
            rows.append({
                "org_key": ok, "resp_id": r["resp_id"], "회사명": r.get("R_Company_Name"),
                "담당자": r.get("R_Name"), "R_Div": r.get("R_Div"), "완성도": r["_comp"],
                "추천_유지": (r["resp_id"] == keep),
                "dedup_dropped": (r["resp_id"] != keep),
                "review_flag": rdiv_conflict,
            })
    out = pd.DataFrame(rows)
    DEDUP_OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(DEDUP_OUT, index=False, encoding="utf-8-sig")
    ngrp = out["org_key"].nunique() if len(out) else 0
    print(f"dedup: 중복 조직 {ngrp}개 그룹, {len(out)}행 → {DEDUP_OUT.relative_to(ROOT)}")
    print(f"  유지 추천 {int(out['추천_유지'].sum()) if len(out) else 0} / "
          f"dedup_dropped {int(out['dedup_dropped'].sum()) if len(out) else 0} / "
          f"검토플래그 그룹 {out[out['review_flag']]['org_key'].nunique() if len(out) else 0}")


def apply_decisions(df: pd.DataFrame, decisions: list[dict]) -> tuple[pd.DataFrame, list]:
    """결정 원장을 적용. 멱등(원본 df + 전체 결정 재적용)."""
    out = assign_ids(df)
    out["excluded_from_kim"] = False
    rid_idx = {rid: i for i, rid in enumerate(out["resp_id"])}
    warns = []
    for d in decisions:
        rid = d["resp_id"]
        if rid not in rid_idx:
            warns.append(f"미존재 resp_id: {rid}")
            continue
        i = rid_idx[rid]
        t = d["type"]
        if t == "correction":
            col = d["field"]
            cur = out.at[out.index[i], col]
            before = d.get("before")
            # 멱등: 이미 after면 스킵, 현재값이 before와도 after와도 다르면 경고+스킵
            if str(cur) == str(d["after"]):
                continue
            if before is not None and str(cur) != str(before):
                warns.append(f"{rid} {col}: 현재값({cur})≠before({before}) → 스킵")
                continue
            out.at[out.index[i], col] = d["after"]
        elif t == "exclusion":
            out.at[out.index[i], "excluded_from_kim"] = bool(d.get("excluded", True))
        elif t == "reclassification":
            out.at[out.index[i], d.get("field", "R_Cate")] = d["after"]
        elif t == "outlier_review":
            pass  # 검수 기록(승인/무시) — 데이터 불변, 미결 집계용 결정
        else:
            warns.append(f"{rid}: 알 수 없는 type {t}")
    return out, warns


def cmd_apply(args):
    df = load_df(args.src)
    decisions = []
    if args.decisions and Path(args.decisions).exists():
        doc = yaml.safe_load(Path(args.decisions).read_text(encoding="utf-8")) or {}
        decisions = doc.get("decisions", [])
    out, warns = apply_decisions(df, decisions)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    out.to_excel(args.out, index=False, sheet_name="Sheet1")
    n_excl = int(out["excluded_from_kim"].sum())
    print(f"apply: 결정 {len(decisions)}건 적용 → {args.out.relative_to(ROOT)}")
    print(f"  exclusion(excluded_from_kim=true): {n_excl}")
    for w in warns:
        print(f"  ⚠ {w}")


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("ingest", "dedup", "apply"):
        sp = sub.add_parser(name)
        sp.add_argument("--src", type=Path, default=DEFAULT_SRC)
        if name == "apply":
            sp.add_argument("--decisions", type=Path, default=ROOT / "config/decisions_21th.yaml")
            sp.add_argument("--out", type=Path, default=DEFAULT_CLEAN_OUT)
    args = p.parse_args()
    {"ingest": cmd_ingest, "dedup": cmd_dedup, "apply": cmd_apply}[args.cmd](args)
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
