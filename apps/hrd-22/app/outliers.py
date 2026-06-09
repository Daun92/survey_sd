"""이상치 검토 — flag 생성 + 결정 대비 미결/해소 판정.

flag 는 cleaned DB(assign_ids 후)에 stage2 규칙을 직접 적용해 만든다.
→ flag.row_idx(=df 위치)가 resp_id(R%04d) 와 정확히 정합하므로 결정 연결이 안전.
설계: docs/CURATION_APP_DESIGN.md §6(이상치 검토), 규칙: config/outlier_rules.yaml.
"""
from __future__ import annotations
from pathlib import Path

import yaml

import curation_engine as ce
import stage2_flag_outliers as st

ROOT = Path(__file__).resolve().parents[1]
RULES = ROOT / "config/outlier_rules.yaml"

# 거시지표 컬럼 → 사람용 라벨
COL_LABEL = {
    "p1)R_1_1_2": "매출액", "p1)R_1_5_2": "교육예산", "p1)R_1_2_2": "인원수",
}
SEV_ORDER = {"critical": 0, "high": 1, "medium": 2}


def col_label(col: str) -> str:
    return COL_LABEL.get(col, col)


def build_flags(df) -> list[dict]:
    """assign_ids 된 df 에 규칙 적용 → flag 목록(resp_id·key 부여, severity 정렬)."""
    rules = yaml.safe_load(RULES.read_text(encoding="utf-8"))
    flags: list[dict] = []
    flags += st.apply_single_column_rules(df, rules.get("single_column_rules", []))
    flags += st.apply_cross_column_rules(df, rules.get("cross_column_rules", []))
    flags += st.apply_respondent_rules(df, rules.get("respondent_rules", []))
    resp_ids = list(df["resp_id"])
    for f in flags:
        f["resp_id"] = resp_ids[f["row_idx"]]
        f["col"] = f["column"]
        f["col_label"] = col_label(f["column"])
        f["key"] = f"{f['resp_id']}__{f['rule_id']}"     # (resp_id, rule) 고유
    flags.sort(key=lambda f: (SEV_ORDER.get(f["severity"], 9), f["resp_id"]))
    return flags


def resolution(flag: dict, decisions: list[dict]) -> dict | None:
    """flag 를 덮는 결정이 있으면 {kind, after?} 반환, 없으면 None(미결).

    - correction(같은 resp_id·field==col)  → kind=corrected
    - outlier_review(같은 resp_id·field==col·rule_id) → kind=resolution(approved/ignored)
    """
    rid, col, rule = flag["resp_id"], flag["col"], flag["rule_id"]
    for d in decisions:
        if d.get("resp_id") != rid:
            continue
        t = d.get("type")
        if t == "correction" and d.get("field") == col:
            return {"kind": "corrected", "after": d.get("after")}
        if t == "outlier_review" and d.get("field") == col and d.get("rule_id") == rule:
            return {"kind": d.get("resolution", "approved")}
    return None


def summarize(flags: list[dict], decisions: list[dict]) -> dict:
    """전체/미결/해소 + severity 별 미결 카운트."""
    pending = [f for f in flags if resolution(f, decisions) is None]
    by_sev = {s: sum(1 for f in pending if f["severity"] == s)
              for s in ("critical", "high", "medium")}
    return {
        "total": len(flags),
        "resolved": len(flags) - len(pending),
        "pending": len(pending),
        "pending_by_sev": by_sev,
    }
