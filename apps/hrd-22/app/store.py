"""결정 원장(decisions yaml) 읽기·추가 — 작업대 화면 공용.

설계: docs/CURATION_APP_DESIGN.md §1(단일 진실원)·§3(스키마).
결정은 항상 append 만 한다(불변 이력). 적용은 curation_engine.apply_decisions 재사용.
"""
from __future__ import annotations
from datetime import datetime
from pathlib import Path

import yaml

_HEADER = "# 결정 원장 — 작업대 append 전용. 적용=curation_engine.apply_decisions.\n"


def load(path: Path) -> tuple[dict, list[dict]]:
    """(meta, decisions) 반환. 파일 없으면 빈 원장."""
    if not Path(path).exists():
        return {}, []
    doc = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    return doc.get("meta", {}), doc.get("decisions", []) or []


def next_id(decisions: list[dict]) -> str:
    """기존 D0001.. 다음 번호. 없으면 D0001."""
    nums = [int(str(d["id"])[1:]) for d in decisions if str(d.get("id", "")).startswith("D")]
    return "D%04d" % ((max(nums) + 1) if nums else 1)


def append(decision: dict, path: Path) -> dict:
    """결정 1건 추가(id·decided_at 자동) 후 원장 재기록. 추가된 결정 반환."""
    meta, decisions = load(path)
    decision = dict(decision)
    decision.setdefault("id", next_id(decisions))
    decision.setdefault("decided_by", "analyst")
    decision.setdefault("decided_at", datetime.now().isoformat(timespec="minutes"))
    decisions.append(decision)
    meta["last_updated"] = datetime.now().isoformat(timespec="minutes")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    body = yaml.safe_dump({"meta": meta, "decisions": decisions},
                          allow_unicode=True, sort_keys=False)
    Path(path).write_text(_HEADER + body, encoding="utf-8")
    return decision
