"""[단계 2] raw 응답 구조 검증 + 완료 필터 + 기본 통계.

처리:
  1) raw xlsx 로드 + tesmi_status='완료' 필터
  2) 22회 codebook 과 컬럼 drift 검증 (누락·신규)
  3) 응답 수 통계 (R_Div / R_Cate 분포, 거시지표 응답률)

출력:
  - 2_validated/raw_validated.xlsx — 완료 + drift 통과한 응답
  - 2_validated/drift_report.md — 드리프트 리포트

사용:
    python scripts/stage2_validate_raw.py
    # 또는 직접 raw 지정:
    python scripts/stage2_validate_raw.py --raw 1_raw/raw_22th.xlsx
"""
from __future__ import annotations
import argparse
import io
import re
import sys
from pathlib import Path

import pandas as pd

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW = ROOT / "1_raw/raw_22th.xlsx"
DEFAULT_CODEBOOK = ROOT / "0_survey/codebook_22th.xlsx"
DEFAULT_OUT = ROOT / "2_validated/raw_validated.xlsx"
DEFAULT_REPORT = ROOT / "2_validated/drift_report.md"

TAG_RE = re.compile(r"<[^>]+>")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    p.add_argument("--codebook", type=Path, default=DEFAULT_CODEBOOK)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    p.add_argument("--include-incomplete", action="store_true",
                   help="tesmi_status='완료' 필터 미적용")
    args = p.parse_args()

    if not args.raw.exists():
        sys.exit(f"raw 없음: {args.raw}")
    if not args.codebook.exists():
        sys.exit(f"codebook 없음: {args.codebook}")

    # 1) Load
    raw = pd.read_excel(args.raw, sheet_name=0, dtype=object)
    cb = pd.read_excel(args.codebook, sheet_name="코드표")
    cb_cols = set(cb["컬럼코드"].astype(str))
    raw_cols = set(raw.columns.astype(str))

    print(f"raw: {raw.shape}")
    print(f"codebook: {len(cb)} 컬럼")

    # 2) Drift
    missing = sorted(cb_cols - raw_cols)
    extra = sorted(raw_cols - cb_cols)
    common = cb_cols & raw_cols
    print(f"\n[Drift]")
    print(f"  codebook 만 (raw 누락): {len(missing)}")
    print(f"  raw 만 (codebook 없음): {len(extra)}")
    print(f"  공통: {len(common)}")

    # 3) 완료 필터
    if "tesmi_status" in raw.columns and not args.include_incomplete:
        raw["tesmi_status"] = raw["tesmi_status"].astype(str).map(
            lambda v: TAG_RE.sub("", v).strip()
        )
        complete_mask = raw["tesmi_status"] == "완료"
        filtered = raw[complete_mask].reset_index(drop=True)
        print(f"\n[완료 필터] {len(raw)} → {len(filtered)} ({complete_mask.sum()} 완료 / {(~complete_mask).sum()} 미완료)")
    else:
        filtered = raw

    # 4) 통계
    stats_lines = ["# 22회 raw 검증 리포트", ""]
    stats_lines.append(f"- raw 파일: `{args.raw.name}`")
    stats_lines.append(f"- raw 전체: {len(raw):,} 응답")
    stats_lines.append(f"- 완료 응답: {len(filtered):,}")
    stats_lines.append("")
    stats_lines.append("## 컬럼 드리프트")
    stats_lines.append("")
    stats_lines.append(f"| 구분 | 개수 |")
    stats_lines.append(f"|---|---:|")
    stats_lines.append(f"| codebook 정의 | {len(cb)} |")
    stats_lines.append(f"| raw 컬럼 | {len(raw_cols)} |")
    stats_lines.append(f"| 공통 (매칭) | {len(common)} |")
    stats_lines.append(f"| codebook 만 (raw 누락) | {len(missing)} |")
    stats_lines.append(f"| raw 만 (codebook 없음) | {len(extra)} |")
    stats_lines.append("")
    if missing:
        stats_lines.append("### codebook 정의 있으나 raw 에 없음")
        stats_lines.append("")
        for c in missing[:30]:
            stats_lines.append(f"- `{c}`")
        if len(missing) > 30:
            stats_lines.append(f"- ... 외 {len(missing) - 30}건")
        stats_lines.append("")
    if extra:
        stats_lines.append("### raw 에 있으나 codebook 정의 없음")
        stats_lines.append("")
        for c in extra[:30]:
            stats_lines.append(f"- `{c}`")
        if len(extra) > 30:
            stats_lines.append(f"- ... 외 {len(extra) - 30}건")
        stats_lines.append("")

    # R_Div / R_Cate 분포
    if "R_Div" in filtered.columns:
        d = pd.to_numeric(filtered["R_Div"], errors="coerce").value_counts(dropna=False).sort_index()
        stats_lines.append("## R_Div (조직구분) 분포")
        stats_lines.append("")
        stats_lines.append("| 코드 | 라벨 | 빈도 |")
        stats_lines.append("|---|---|---:|")
        div_labels = {1: "대기업", 2: "중기업", 3: "소기업", 4: "공공기관", 5: "학교"}
        for k, v in d.items():
            lbl = div_labels.get(k, "기타/미응답")
            stats_lines.append(f"| {k} | {lbl} | {v} |")
        stats_lines.append("")

    # 거시지표 응답률
    macro = ["p1)R_1_1_2", "p1)R_1_2_2", "p1)R_1_3_2", "p1)R_1_5_2", "p1)R_2_n_2"]
    stats_lines.append("## 거시지표 응답률")
    stats_lines.append("")
    stats_lines.append("| 컬럼 | 응답 | 비율 |")
    stats_lines.append("|---|---:|---:|")
    for c in macro:
        if c in filtered.columns:
            n = pd.to_numeric(filtered[c], errors="coerce").notna().sum()
            stats_lines.append(f"| `{c}` | {n} | {100*n/len(filtered):.1f}% |")
    stats_lines.append("")

    # 5) 저장
    args.out.parent.mkdir(parents=True, exist_ok=True)
    filtered.to_excel(args.out, index=False, sheet_name="Sheet1")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text("\n".join(stats_lines), encoding="utf-8")

    print(f"\n출력:")
    print(f"  - {args.out.relative_to(ROOT)}")
    print(f"  - {args.report.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
