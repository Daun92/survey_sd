"""업종 재분류 — etc(기업기타) 응답을 표준 업종으로 매핑.

후보 = 기업 모집단(R_Div 1·2·3) 중 R_Cate=='etc'.
analyst 가 R_Cate_Name(자유응답)을 보고 표준 업종 코드로 재분류.
설계: docs/CURATION_APP_DESIGN.md §6, 코드↔라벨: config/segments.yaml column_groups id=1.
결정: type=reclassification, field=R_Cate, after=코드, after_label=라벨.
"""
from __future__ import annotations
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
SEG = yaml.safe_load((ROOT / "config/segments.yaml").read_text(encoding="utf-8"))
_OPTS = next(g for g in SEG["column_groups"] if g["id"] == 1)["options"]

# 재분류 대상 코드(기업 업종 1~13). etc 는 출발점이라 제외.
CHOICES = [(c, _OPTS[c]) for c in sorted((k for k in _OPTS if k != "etc"), key=int)]
_LABEL = dict(CHOICES)


def label_of(code) -> str:
    return _LABEL.get(str(code), str(code))


def candidates(df) -> list[dict]:
    """기업 R_Cate=='etc' 행 → resp_id·회사명·자유응답(힌트)."""
    rdiv = pd.to_numeric(df["R_Div"], errors="coerce")
    cate = df["R_Cate"].astype(str).str.strip().str.lower()
    mask = rdiv.isin([1, 2, 3]) & (cate == "etc")
    rows = []
    for _, r in df[mask].iterrows():
        rows.append({
            "resp_id": r["resp_id"],
            "company": r.get("R_Company_Name"),
            "cate_name": r.get("R_Cate_Name"),
            "key": r["resp_id"],
        })
    return rows


def resolution(resp_id: str, decisions: list[dict]) -> dict | None:
    """해당 resp_id 의 R_Cate 재분류 결정이 있으면 {after, after_label}."""
    for d in reversed(decisions):
        if (d.get("resp_id") == resp_id and d.get("type") == "reclassification"
                and d.get("field", "R_Cate") == "R_Cate"):
            return {"after": d.get("after"),
                    "after_label": d.get("after_label") or label_of(d.get("after"))}
    return None


def summarize(cands: list[dict], decisions: list[dict]) -> dict:
    done = sum(1 for c in cands if resolution(c["resp_id"], decisions))
    return {"total": len(cands), "done": done, "pending": len(cands) - done}
