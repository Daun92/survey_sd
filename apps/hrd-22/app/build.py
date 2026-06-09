"""산출/미리보기 — 결정 적용 스냅샷 → 김태웅 xlsx + chart_data.json 재생성.

설계 데이터 흐름(§1): DATA(정제DB) + decisions → apply_decisions → 스냅샷 xlsx
→ 검증된 stage4 스크립트 2종을 그대로 실행(subprocess) → 김태웅/chart_data.
출력은 검증 fixture 와 분리하려 `_app_` 접두 경로 사용(언제든 재생성 가능한 파생물).
"""
from __future__ import annotations
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import curation_engine as ce

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
SNAPSHOT = ROOT / "4_aggregated/_app_snapshot.xlsx"
KIM_OUT = ROOT / "4_aggregated/_app_김태웅.xlsx"
CHART_OUT = ROOT / "4_aggregated/_app_chart_data.json"

_SHEET_N = re.compile(r"\[(.+?)\]\s*N\s*=\s*(\d+)")


def _parse_iso(s):
    try:
        return datetime.fromisoformat(str(s))
    except (TypeError, ValueError):
        return None


def make_snapshot(data_path: Path, decisions: list[dict], snap: Path) -> tuple[int, list]:
    df = ce.load_df(data_path)
    out, warns = ce.apply_decisions(df, decisions)
    snap.parent.mkdir(parents=True, exist_ok=True)
    out.to_excel(snap, index=False, sheet_name="Sheet1")
    return len(out), warns


def _run(script: str, src: Path, out: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPTS / script), "--src", str(src), "--out", str(out)],
        capture_output=True, text=True, encoding="utf-8", errors="replace")


def run(data_path: Path, decisions: list[dict], *,
        snap: Path = SNAPSHOT, kim_out: Path = KIM_OUT, chart_out: Path = CHART_OUT) -> dict:
    """스냅샷 + 두 산출 실행. 결과 요약 dict 반환."""
    n_applied, warns = make_snapshot(data_path, decisions, snap)
    r_kim = _run("stage4_build_kim_xlsx.py", snap, kim_out)
    r_chart = _run("stage4_extract_chart_data.py", snap, chart_out)
    ok = r_kim.returncode == 0 and r_chart.returncode == 0
    sheets = [{"name": m.group(1), "N": int(m.group(2))}
              for m in _SHEET_N.finditer(r_kim.stdout)]
    chart = chart_overview(chart_out) if chart_out.exists() else {}
    return {
        "ok": ok, "n_applied": n_applied, "warns": warns,
        "sheets": sheets, "chart": chart,
        "kim_log": (r_kim.stdout + r_kim.stderr).strip(),
        "chart_log": (r_chart.stdout + r_chart.stderr).strip(),
        "kim_out": kim_out, "chart_out": chart_out,
    }


def chart_overview(chart_out: Path) -> dict:
    """chart_data.json 요약 — 도표 수·모집단 N·집계법 분포."""
    data = json.loads(chart_out.read_text(encoding="utf-8"))
    charts = data.get("charts", [])
    aggs: dict[str, int] = {}
    for c in charts:
        aggs[c["agg"]] = aggs.get(c["agg"], 0) + 1
    return {"n_charts": len(charts), "population_N": data.get("population_N", {}),
            "aggs": dict(sorted(aggs.items())), "source": data.get("source")}


def output_status(meta: dict, kim_out: Path = KIM_OUT, chart_out: Path = CHART_OUT) -> dict:
    """산출물 존재·생성시각·신선도(원장 last_updated 대비)."""
    led = _parse_iso(meta.get("last_updated"))

    def one(p: Path) -> dict:
        if not p.exists():
            return {"exists": False}
        mt = datetime.fromtimestamp(p.stat().st_mtime)
        fresh = None if led is None else (mt >= led)
        return {"exists": True, "mtime": mt.isoformat(timespec="minutes"), "fresh": fresh}

    return {"ledger_updated": meta.get("last_updated"),
            "kim": one(kim_out), "chart": one(chart_out)}
