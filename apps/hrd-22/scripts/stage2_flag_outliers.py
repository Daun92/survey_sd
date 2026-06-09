"""[단계 2] 이상치 후보 자동 플래그.

config/outlier_rules.yaml 규칙을 검증된 raw 에 적용 →
이상치 후보를 (응답자 × 컬럼 × 규칙) 단위로 추출.

출력:
  - 2_validated/outlier_report.xlsx — 분석가 검수용
    · 시트 'flags': 이상치 후보 (응답자, 컬럼, 규칙, 값, severity, note)
    · 시트 'summary': 규칙별 / severity 별 카운트

사용:
    # 21회 reverse-run 검증
    python scripts/stage2_flag_outliers.py \\
        --raw reference/21th_raw.xlsx \\
        --filter-complete \\
        --out workspace/test_outlier_21th.xlsx

    # 22회 실제
    python scripts/stage2_flag_outliers.py
"""
from __future__ import annotations
import argparse
import io
import re
import sys
from pathlib import Path

import pandas as pd
import yaml

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW = ROOT / "2_validated/raw_validated.xlsx"
DEFAULT_RULES = ROOT / "config/outlier_rules.yaml"
DEFAULT_OUT = ROOT / "2_validated/outlier_report.xlsx"

TAG_RE = re.compile(r"<[^>]+>")
ID_COLS = ["R_Company_Name", "R_Part_Name", "R_Div", "R_Cate"]


def _num(v):
    if v is None:
        return None
    try:
        return float(str(v).strip().replace(",", ""))
    except (ValueError, AttributeError):
        return None


def evaluate_condition(condition: str, value: float) -> bool:
    """간단한 조건 평가 (eval). 변수 'value' 만 노출."""
    try:
        return bool(eval(condition, {"__builtins__": {}}, {"value": value}))
    except Exception:
        return False


def apply_single_column_rules(df: pd.DataFrame, rules: list[dict]) -> list[dict]:
    flags = []
    for rule in rules:
        col = rule["col"]
        if col not in df.columns:
            continue
        for idx, val in df[col].items():
            v = _num(val)
            if v is None:
                continue
            if evaluate_condition(rule["condition"], v):
                flag = {
                    "row_idx": idx,
                    "rule_id": rule.get("flag", "?"),
                    "rule_type": "single_column",
                    "column": col,
                    "value": v,
                    "severity": rule.get("severity", "medium"),
                    "note": rule.get("note", ""),
                }
                for id_col in ID_COLS:
                    if id_col in df.columns:
                        flag[id_col] = df.at[idx, id_col]
                flags.append(flag)
    return flags


def _make_flag(idx, rule, df, value, expression):
    flag = {
        "row_idx": idx,
        "rule_id": rule.get("id", "?"),
        "rule_type": "cross_column",
        "column": expression,
        "value": value,
        "severity": rule.get("severity", "medium"),
        "note": rule.get("note", ""),
    }
    for id_col in ID_COLS:
        if id_col in df.columns:
            flag[id_col] = df.at[idx, id_col]
    return flag


def apply_cross_column_rules(df: pd.DataFrame, rules: list[dict]) -> list[dict]:
    """cross_column 규칙 — id 별 하드코딩 (eval 안전성 + 명확성)."""
    flags = []
    for idx, row in df.iterrows():
        bud = _num(row.get("p1)R_1_5_2"))
        rev = _num(row.get("p1)R_1_1_2"))
        emp = _num(row.get("p1)R_1_2_2"))
        tgt = _num(row.get("p1)R_1_3_2"))

        for rule in rules:
            rid = rule.get("id")
            upper = rule.get("upper_threshold")
            lower = rule.get("lower_threshold")

            if rid == "ratio_budget_vs_revenue":
                if bud and rev and rev > 0:
                    ratio = bud / rev
                    if (upper is not None and ratio > upper) or (lower is not None and ratio < lower):
                        flags.append(_make_flag(idx, rule, df, ratio, "p1)R_1_5_2 / p1)R_1_1_2"))

            elif rid == "budget_exceeds_revenue":
                if bud is not None and rev is not None:
                    diff = bud - rev
                    if upper is not None and diff > upper:
                        flags.append(_make_flag(idx, rule, df, diff, "p1)R_1_5_2 - p1)R_1_1_2"))

            elif rid == "emp_revenue_mismatch":
                if emp and rev and emp > 0:
                    per_emp = rev / emp
                    if (upper is not None and per_emp > upper) or (lower is not None and per_emp < lower):
                        flags.append(_make_flag(idx, rule, df, per_emp, "p1)R_1_1_2 / p1)R_1_2_2"))

            elif rid == "peremp_per_target":
                if bud and tgt and tgt > 0:
                    per = bud / tgt
                    if (upper is not None and per > upper) or (lower is not None and per < lower):
                        flags.append(_make_flag(idx, rule, df, per, "p1)R_1_5_2 / p1)R_1_3_2"))
    return flags


def apply_respondent_rules(df: pd.DataFrame, rules: list[dict]) -> list[dict]:
    flags = []
    for rule in rules:
        cols = rule.get("columns", [])
        threshold = rule.get("flag_if_zero_count_gte", 0)
        for idx, row in df.iterrows():
            zero_count = 0
            for c in cols:
                if c in row.index:
                    v = _num(row[c])
                    if v == 0:
                        zero_count += 1
            if zero_count >= threshold:
                flag = {
                    "row_idx": idx,
                    "rule_id": rule.get("id", "?"),
                    "rule_type": "respondent",
                    "column": ",".join(cols),
                    "value": zero_count,
                    "severity": rule.get("severity", "medium"),
                    "note": rule.get("note", ""),
                }
                for id_col in ID_COLS:
                    if id_col in df.columns:
                        flag[id_col] = df.at[idx, id_col]
                flags.append(flag)
    return flags


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    p.add_argument("--rules", type=Path, default=DEFAULT_RULES)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--filter-complete", action="store_true",
                   help="원본 raw 직접 사용 시 tesmi_status='완료' 필터")
    args = p.parse_args()

    if not args.raw.exists():
        sys.exit(f"raw 없음: {args.raw}")
    if not args.rules.exists():
        sys.exit(f"rules 없음: {args.rules}")

    df = pd.read_excel(args.raw, sheet_name=0, dtype=object)
    if args.filter_complete and "tesmi_status" in df.columns:
        df["tesmi_status"] = df["tesmi_status"].astype(str).map(lambda v: TAG_RE.sub("", v).strip())
        df = df[df["tesmi_status"] == "완료"].reset_index(drop=True)
    print(f"입력: {df.shape}")

    rules = yaml.safe_load(args.rules.read_text(encoding="utf-8"))
    flags = []
    flags += apply_single_column_rules(df, rules.get("single_column_rules", []))
    flags += apply_cross_column_rules(df, rules.get("cross_column_rules", []))
    flags += apply_respondent_rules(df, rules.get("respondent_rules", []))

    print(f"이상치 후보: {len(flags)}건")

    # Output
    args.out.parent.mkdir(parents=True, exist_ok=True)
    flag_df = pd.DataFrame(flags)
    if not flag_df.empty:
        # 응답자별 정렬
        sort_cols = ["row_idx", "severity", "rule_id"]
        flag_df = flag_df.sort_values([c for c in sort_cols if c in flag_df.columns])

    # Summary
    sev_counts = flag_df["severity"].value_counts() if "severity" in flag_df else pd.Series(dtype=int)
    rule_counts = flag_df["rule_id"].value_counts() if "rule_id" in flag_df else pd.Series(dtype=int)
    summary = pd.DataFrame({
        "지표": (
            [f"전체 응답자: {len(df)}", f"이상치 후보: {len(flags)}", "─── severity ───"] +
            [f"{s}" for s in sev_counts.index] +
            ["─── rule_id ───"] +
            [f"{r}" for r in rule_counts.index]
        ),
        "값": (
            [len(df), len(flags), ""] +
            [int(v) for v in sev_counts.values] +
            [""] +
            [int(v) for v in rule_counts.values]
        ),
    })

    with pd.ExcelWriter(args.out, engine="openpyxl") as w:
        flag_df.to_excel(w, sheet_name="flags", index=False)
        summary.to_excel(w, sheet_name="summary", index=False)

    print(f"\n출력: {args.out}")
    print(f"\nseverity 별:")
    print(sev_counts.to_string() if len(sev_counts) else "  (없음)")
    print(f"\nrule_id 별:")
    print(rule_counts.to_string() if len(rule_counts) else "  (없음)")

    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
