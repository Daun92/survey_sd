"""worklog.yaml 에 새 entry 추가 헬퍼.

사용:
    python scripts/add_worklog.py --stage 0 --type deliverable \\
        --title "단계 0 codebook patch" \\
        --desc "Part V 16컬럼 신규 + Part I R_11 추가" \\
        --artifacts "0_survey/codebook_22th.xlsx,0_survey/codebook_patch_report.md"

또는 yaml 을 직접 편집해도 됨.
"""
from __future__ import annotations
import argparse
import io
import sys
from datetime import datetime
from pathlib import Path

import yaml

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
WORKLOG = ROOT / "worklog.yaml"

VALID_TYPES = {"setup", "analysis", "decision", "deliverable", "finding", "blocker"}
VALID_STAGES = {"setup", 0, 1, 2, 3, 4, 5}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--stage", required=True,
                   help="setup | 0 | 1 | 2 | 3 | 4 | 5")
    p.add_argument("--type", required=True,
                   help=f"{'|'.join(sorted(VALID_TYPES))}")
    p.add_argument("--title", required=True)
    p.add_argument("--desc", default="")
    p.add_argument("--artifacts", default="",
                   help="쉼표 구분 경로 목록")
    p.add_argument("--timestamp", default=None,
                   help="기본 = 현재 시각")
    args = p.parse_args()

    stage = args.stage
    try:
        stage = int(stage)
    except ValueError:
        pass
    if stage not in VALID_STAGES:
        sys.exit(f"--stage 는 {VALID_STAGES} 중 하나")
    if args.type not in VALID_TYPES:
        sys.exit(f"--type 은 {VALID_TYPES} 중 하나")

    if WORKLOG.exists():
        data = yaml.safe_load(WORKLOG.read_text(encoding="utf-8")) or {}
    else:
        data = {}
    entries = data.get("entries", [])
    next_id = max((e.get("id", 0) for e in entries), default=0) + 1

    new = {
        "id": next_id,
        "timestamp": args.timestamp or datetime.now().strftime("%Y-%m-%dT%H:%M"),
        "stage": stage,
        "type": args.type,
        "title": args.title,
    }
    if args.desc:
        new["description"] = args.desc
    if args.artifacts:
        new["artifacts"] = [a.strip() for a in args.artifacts.split(",") if a.strip()]
    entries.append(new)
    data["entries"] = entries

    WORKLOG.write_text(
        yaml.dump(data, allow_unicode=True, sort_keys=False, default_flow_style=False),
        encoding="utf-8"
    )
    stage_str = new["stage"]
    print(f"+ id={next_id} [{new['timestamp']}] stage={stage_str} type={new['type']} title={new['title']}")
    print(f"  worklog.yaml 갱신. 대시보드 재생성: python scripts/update_dashboard.py")


if __name__ == "__main__":
    sys.exit(main() or 0)
