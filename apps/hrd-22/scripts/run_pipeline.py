"""일일 데이터 갱신 파이프라인 orchestrator.

  fetch_raw → stage2_validate_raw → (deck · result · segment · 이상치 · 대시보드 · 허브+퍼블리시) 재생성

각 단계를 순차 실행하고, 실패 시 즉시 중단(비정상 종료코드)하여 스케줄러/알림이 인지하게 한다.
모든 단계는 raw_validated.xlsx 까지 결정론적이며, 큐레이션(중복제거·임의제외·업종재분류)은 포함하지 않는다
(분석가 판단 영역 — prelim 자동 재생성은 '잠정 raw 기준').

사용:
  python scripts/run_pipeline.py                 # 전체: 다운로드+검증+재생성
  python scripts/run_pipeline.py --no-fetch       # 기존 1_raw 로 검증·재생성만
  python scripts/run_pipeline.py --no-render       # 다운로드+검증까지만
"""
from __future__ import annotations

import argparse
import io
import subprocess
import sys
import time
from pathlib import Path

# 콘솔이 cp949면 진행 메시지의 이모지(✅ 등)에서 UnicodeEncodeError → 모든 단계 성공 후에도
# 마지막 print에서 크래시(비정상 종료코드)해 스케줄러가 실패로 오인. UTF-8 출력으로 통일.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable
RAW_FILE = ROOT / "1_raw" / "제 22회 인재개발 실태조사_All.xlsx"

# (이름, 명령) — 명령은 sys.executable 기준 인자 리스트
STEPS_FETCH = [
    ("fetch_raw", [PY, "scripts/fetch_raw.py"]),
]
STEPS_VALIDATE = [
    ("validate", [PY, "scripts/stage2_validate_raw.py", "--raw", str(RAW_FILE)]),
]
STEPS_RENDER = [
    ("deck", [PY, "scripts/stage5_render_deck.py"]),
    ("result", [PY, "scripts/stage5_render_html.py"]),
    ("segment_report", [PY, "scripts/stage5_render_segment_report.py"]),
    ("outliers", [PY, "scripts/stage2_flag_outliers.py"]),          # 이상치 후보 재검출(outlier_report.xlsx)
    ("dashboard", [PY, "scripts/stage6_render_dashboard.py"]),      # 수집현황+이상치 모니터링 대시보드
    ("raw_appendix", [PY, "scripts/stage6_render_raw_appendix.py"]),  # 응답 상세 부록(원자료)
    ("hub", [PY, "scripts/stage6_render_hub.py"]),                  # 종합 허브 + 퍼블리시 묶음(5_report/publish/)
]


def _ts() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def run_step(name: str, cmd: list[str]) -> None:
    print(f"\n=== [{_ts()}] {name} ===", flush=True)
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode != 0:
        raise SystemExit(f"[run_pipeline] '{name}' 실패 (exit {r.returncode}) — 파이프라인 중단")


def run_step_soft(name: str, cmd: list[str]) -> int:
    """비치명 단계 — 실패해도 파이프라인 중단 안 함(로컬 산출물은 이미 유효). exit 2=건너뜀."""
    print(f"\n=== [{_ts()}] {name} (비치명) ===", flush=True)
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode == 2:
        print(f"[run_pipeline] '{name}' 건너뜀 — 계속")
    elif r.returncode != 0:
        print(f"[run_pipeline] ⚠ '{name}' 실패 (exit {r.returncode}) — 로컬 산출물은 유효, 계속")
    return r.returncode


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--no-fetch", action="store_true", help="다운로드 생략(기존 1_raw 사용)")
    ap.add_argument("--no-render", action="store_true", help="재생성 생략(검증까지만)")
    ap.add_argument("--no-upload", action="store_true", help="apps.exc.co.kr 업로드 생략")
    args = ap.parse_args()

    steps: list[tuple[str, list[str]]] = []
    if not args.no_fetch:
        steps += STEPS_FETCH
    steps += STEPS_VALIDATE
    if not args.no_render:
        steps += STEPS_RENDER

    t0 = time.time()
    print(f"[run_pipeline] 시작 {_ts()} · 단계 {[n for n, _ in steps]}")
    for name, cmd in steps:
        run_step(name, cmd)
    # 업로드 = 비치명 마지막 단계 (자격증명 없으면 건너뜀, 실패해도 중단 안 함)
    if not args.no_render and not args.no_upload:
        run_step_soft("upload", [PY, "scripts/upload_apps.py"])
    print(f"\n[run_pipeline] ✅ 완료 ({time.time() - t0:.0f}s) {_ts()}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
