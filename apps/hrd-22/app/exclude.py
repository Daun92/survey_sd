"""포함/제외 — excluded_from_kim 토글 + 실시간 모집단 N.

제외 결정(type=exclusion, excluded true/false)을 append. 같은 resp_id 는 최신 결정이 유효.
실제 상태/카운트는 curation_engine.apply_decisions + stage4.build_population 로 산출(단일 진실원).
설계: docs/CURATION_APP_DESIGN.md §5(N 공식)·§6.
"""
from __future__ import annotations
from pathlib import Path

import pandas as pd
import yaml

import curation_engine as ce
import stage4_extract_chart_data as ex

ROOT = Path(__file__).resolve().parents[1]
PF = yaml.safe_load((ROOT / "config/segments.yaml").read_text(encoding="utf-8"))["population_filter"]


def applied(df, decisions: list[dict]):
    """결정 적용된 df (excluded_from_kim 포함)."""
    out, _ = ce.apply_decisions(df, decisions)
    return out


def counts(df, decisions: list[dict]) -> dict:
    """실시간 모집단 N (기업/공공) + 제외 건수."""
    out = applied(df, decisions)
    pop = ex.build_population(out, PF)
    rdiv = pd.to_numeric(pop["R_Div"], errors="coerce")
    return {
        "corp_N": int(rdiv.isin([1, 2, 3]).sum()),
        "pub_N": int(rdiv.isin([4, 5]).sum()),
        "excluded_n": int(out["excluded_from_kim"].sum()),
    }


def _last_exclusion_reason(resp_id: str, decisions: list[dict]) -> str:
    for d in reversed(decisions):
        if d.get("resp_id") == resp_id and d.get("type") == "exclusion":
            return d.get("reason", "")
    return ""


def row_state(resp_id: str, out_df) -> bool:
    """현재 제외 여부 (apply 결과 기준)."""
    sel = out_df[out_df["resp_id"] == resp_id]
    return bool(sel["excluded_from_kim"].iloc[0]) if len(sel) else False


def _mkrow(r, excluded, reason="") -> dict:
    return {
        "resp_id": r["resp_id"], "company": r.get("R_Company_Name"),
        "rdiv": r.get("R_Div"), "excluded": excluded, "reason": reason,
        "key": r["resp_id"],
    }


def excluded_rows(df, decisions: list[dict]) -> list[dict]:
    out = applied(df, decisions)
    rows = []
    for _, r in out[out["excluded_from_kim"] == True].iterrows():  # noqa: E712
        rows.append(_mkrow(r, True, _last_exclusion_reason(r["resp_id"], decisions)))
    return rows


def search(df, decisions: list[dict], q: str, limit: int = 40) -> list[dict]:
    """회사명·resp_id 부분일치 검색 → 현재 제외 상태 포함."""
    q = (q or "").strip()
    if not q:
        return []
    out = applied(df, decisions)
    name = out["R_Company_Name"].astype(str)
    rid = out["resp_id"].astype(str)
    mask = name.str.contains(q, case=False, na=False) | rid.str.contains(q, case=False, na=False)
    rows = []
    for _, r in out[mask].head(limit).iterrows():
        rows.append(_mkrow(r, bool(r["excluded_from_kim"])))
    return rows
