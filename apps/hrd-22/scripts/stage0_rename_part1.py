"""[단계 0] 22회 codebook Part I 컬럼 rename + 21회_매핑 열 추가.

배경:
  설문 webapp(=raw export)이 22회 신규 번호 체계(R_1~R_10)를 사용하지만
  stage 0 패치 시 codebook 은 21회 번호 체계(R_1, R_3, R_4, R_6 ... R_14)를 유지한 채
  +1삭제/+1신규만 반영되어 23개 Part I 컬럼명이 어긋남.

동작:
  1) codebook_22th.xlsx 의 '코드표' 시트를 백업
  2) workspace/part1_rename_map.yaml 의 renames 항목대로 컬럼코드 셀 일괄 치환
  3) '응답형식' 우측에 '21회_매핑' 신규 열 추가
     - rename 된 행: 21회 원본 컬럼코드 값 기록
     - 그 외 행: 공백 (Part II/III/IV/V 및 기본정보)
  4) side_effects 적용 (하위항목 텍스트 갱신 등)
  5) drift 재검증 안내

사용:
    python scripts/stage0_rename_part1.py --dry-run     # 변경 사항만 출력
    python scripts/stage0_rename_part1.py               # 실제 적용 (백업 자동 생성)

작성: 2026-05-28 (raw 응답 조기 도착 + drift 23건 발견 시점)
"""
from __future__ import annotations

import argparse
import io
import shutil
import sys
from datetime import datetime
from pathlib import Path

import openpyxl
import yaml

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CODEBOOK = ROOT / "0_survey/codebook_22th.xlsx"
DEFAULT_MAP = ROOT / "workspace/part1_rename_map.yaml"
NEW_COL_NAME = "21회_매핑"

# side effects: (컬럼코드 신번호, 대상 열, 기존 값, 새 값)
SIDE_EFFECTS = [
    ("p1)R_2_n_2", "하위항목", "23년 대비 24년 증감율", "24년 대비 25년 증감율"),
]


def load_rename_map(path: Path) -> dict[str, str]:
    """Returns dict[old_column_code] = new_column_code."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return {r["old"]: r["new"] for r in data["renames"]}


def find_header_columns(ws) -> dict[str, int]:
    """Returns header -> 1-based column index for row 1."""
    return {ws.cell(row=1, column=c).value: c for c in range(1, ws.max_column + 1)}


def apply_renames(ws, rename_map: dict[str, str], col_code_idx: int, dry_run: bool) -> list[tuple[int, str, str]]:
    """Apply rename in 컬럼코드 column. Returns list of (row, old, new) for applied changes."""
    applied = []
    for r in range(2, ws.max_row + 1):
        cell = ws.cell(row=r, column=col_code_idx)
        v = str(cell.value) if cell.value is not None else ""
        if v in rename_map:
            new = rename_map[v]
            applied.append((r, v, new))
            if not dry_run:
                cell.value = new
    return applied


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--codebook", type=Path, default=DEFAULT_CODEBOOK)
    ap.add_argument("--map", type=Path, default=DEFAULT_MAP, dest="map_path")
    ap.add_argument("--dry-run", action="store_true",
                    help="변경 사항만 출력하고 파일 수정 안 함")
    args = ap.parse_args()

    if not args.codebook.exists():
        sys.exit(f"codebook 없음: {args.codebook}")
    if not args.map_path.exists():
        sys.exit(f"rename map 없음: {args.map_path}")

    rename_map = load_rename_map(args.map_path)
    print(f"[load] rename map: {len(rename_map)}쌍")
    print(f"[load] codebook:   {args.codebook.relative_to(ROOT)}")

    wb = openpyxl.load_workbook(args.codebook)
    if "코드표" not in wb.sheetnames:
        sys.exit("'코드표' 시트 없음")
    ws = wb["코드표"]

    headers = find_header_columns(ws)
    if "컬럼코드" not in headers:
        sys.exit("'컬럼코드' 열을 찾을 수 없음")

    col_code_idx = headers["컬럼코드"]

    # 1) Renames
    applied = apply_renames(ws, rename_map, col_code_idx, args.dry_run)
    print(f"\n[rename] {len(applied)}건 / {len(rename_map)}쌍 매핑 중 매칭:")
    for r, old, new in applied:
        print(f"  row {r:3d}: {old:20s} → {new}")

    unmatched = set(rename_map.keys()) - {old for _, old, _ in applied}
    if unmatched:
        print(f"\n[warn] rename map 에는 있으나 codebook 에 없는 컬럼:")
        for u in sorted(unmatched):
            print(f"  - {u}")

    # 2) Add 21회_매핑 column
    if NEW_COL_NAME in headers:
        new_col_idx = headers[NEW_COL_NAME]
        print(f"\n[col] '{NEW_COL_NAME}' 열 기존 위치(col {new_col_idx}) 재사용")
    else:
        # Insert right after the last existing column
        new_col_idx = ws.max_column + 1
        if args.dry_run:
            print(f"\n[col] '{NEW_COL_NAME}' 열 신규 추가 위치: col {new_col_idx}")
        else:
            ws.cell(row=1, column=new_col_idx, value=NEW_COL_NAME)
            print(f"\n[col] '{NEW_COL_NAME}' 열 신규 추가: col {new_col_idx}")

    # Fill rename mapping in 21회_매핑 (use applied list so dry-run/real 모두 정확)
    fill_count = 0
    for r, old, new in applied:
        if not args.dry_run:
            ws.cell(row=r, column=new_col_idx, value=old)
        fill_count += 1
    print(f"[col] 21회_매핑 값 채움: {fill_count}행")

    # 3) Side effects (신번호 → 행번호 lookup via applied list)
    new_to_row = {new: r for r, _, new in applied}
    print(f"\n[side_effects] 적용 {len(SIDE_EFFECTS)}건:")
    for code, col_name, old_val, new_val in SIDE_EFFECTS:
        if col_name not in headers:
            print(f"  - skip ({col_name} 열 없음)")
            continue
        if code not in new_to_row:
            print(f"  - {code} rename 결과에 없음 → skip")
            continue
        col_idx = headers[col_name]
        r = new_to_row[code]
        cur = str(ws.cell(row=r, column=col_idx).value or "")
        if cur == old_val:
            print(f"  - row {r}: {code} [{col_name}] '{old_val}' → '{new_val}'")
            if not args.dry_run:
                ws.cell(row=r, column=col_idx, value=new_val)
        else:
            print(f"  - row {r}: {code} [{col_name}] 현재값 '{cur}' ≠ 기대값 '{old_val}' → skip (이미 갱신됨 또는 텍스트 차이)")

    # 4) Save
    if args.dry_run:
        print("\n[dry-run] 파일 수정 없이 종료. 위 변경을 적용하려면 --dry-run 빼고 재실행.")
        return 0

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = args.codebook.with_name(f"{args.codebook.stem}.bak_{ts}.xlsx")
    shutil.copy2(args.codebook, backup)
    print(f"\n[backup] {backup.relative_to(ROOT)}")

    wb.save(args.codebook)
    print(f"[save]   {args.codebook.relative_to(ROOT)}")

    print("\n다음 단계 권장:")
    print(f"  python scripts/stage2_validate_raw.py --raw \"1_raw/제 22회 인재개발 실태조사_All.xlsx\"")
    print(f"  → drift 0 확인")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
