"""[시험용] 21회 cleaned 데이터를 22회 export 변수명으로 변환.

22회 config(segments.yaml·chart_specs.yaml·codebook_22th.xlsx)가 모두 22회 이름
기준이므로, 21회 데이터로 엔진을 시험하려면 컬럼명을 22회로 맞춰야 한다.

매핑: config/round_var_map_21_22.yaml (22→21) 을 역전(21→22)해 적용.

충돌 처리(Plan 검증 실측):
  - 21회 native R_9_1_*(22회 삭제 문항)가 22회 R_9_1_*(=21 R_6_1_*의 타깃)와 이름 충돌
    → "22회 타깃이면서 매핑 소스가 아닌 21회 컬럼"을 drop.
  - pandas가 중복 헤더에 붙인 '.1' 접미사 컬럼 drop.
  - 22회에만 있고 21회에 없는 변수(R_13_multi 등)는 NaN 컬럼 추가 + 로그.

사용:
    python scripts/round_adapter.py
    python scripts/round_adapter.py --src reference/21th_cleaned.xlsx --out workspace/21th_cleaned_as22.xlsx
"""
from __future__ import annotations
import argparse
import io
import re
import sys
from pathlib import Path

import openpyxl as op
import pandas as pd
import yaml

if __name__ == "__main__" and sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
MAP_YAML = ROOT / "config/round_var_map_21_22.yaml"
CODEBOOK = ROOT / "0_survey/codebook_22th.xlsx"
DEFAULT_SRC = ROOT / "reference/21th_cleaned.xlsx"
DEFAULT_OUT = ROOT / "workspace/21th_cleaned_as22.xlsx"

DOT_SUFFIX = re.compile(r"\.\d+$")   # pandas 중복헤더 접미사 (예: 'p1)R_1_5_2.1')


def load_inverse_map() -> dict[str, str]:
    m = yaml.safe_load(MAP_YAML.read_text(encoding="utf-8"))["var_map_22_to_21"]
    return {v21: v22 for v22, v21 in m.items()}   # 21 → 22


def codebook_vars() -> list[str]:
    wb = op.load_workbook(CODEBOOK, read_only=True)
    ws = wb.worksheets[0]
    out = [r[0] for i, r in enumerate(ws.iter_rows(values_only=True)) if i >= 1 and r[0]]
    wb.close()
    return out


def adapt(df: pd.DataFrame, inv: dict[str, str]) -> tuple[pd.DataFrame, dict]:
    log = {"dropped_21native": [], "dropped_dup_suffix": [], "missing_in_21th": []}
    cols = list(df.columns)
    sources = set(inv.keys())          # 21회 이름(매핑 대상)
    targets = set(inv.values())        # 22회 이름(타깃)

    # 1) pandas 중복헤더 '.N' 접미사 컬럼 drop
    dup_suffixed = [c for c in cols if isinstance(c, str) and DOT_SUFFIX.search(c)
                    and DOT_SUFFIX.sub("", c) in cols]
    if dup_suffixed:
        df = df.drop(columns=dup_suffixed)
        log["dropped_dup_suffix"] = dup_suffixed

    # 2) 22회 타깃과 이름이 같은데 매핑 소스가 아닌 21회 native 컬럼 drop (예: 공공직급별 R_9_1_*)
    native_collide = [c for c in df.columns if c in targets and c not in sources]
    if native_collide:
        df = df.drop(columns=native_collide)
        log["dropped_21native"] = native_collide

    # 3) rename (21 → 22). 동시 적용이라 R_5_1_2→R_7_1_2 / R_7_1_2→R_11_1_2 충돌 없음
    df = df.rename(columns=inv)

    # 4) 중복 컬럼 잔존 검사
    dups = df.columns[df.columns.duplicated()].tolist()
    assert not dups, f"rename 후 중복 컬럼 잔존: {dups}"

    # 5) 22회 코드북에 있으나 변환 결과에 없는 변수 → NaN 컬럼 일괄 추가
    have = set(df.columns)
    missing = [v for v in codebook_vars() if v not in have]
    if missing:
        add = pd.DataFrame({v: pd.NA for v in missing}, index=df.index)
        df = pd.concat([df, add], axis=1)
        log["missing_in_21th"] = missing

    return df, log


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--src", type=Path, default=DEFAULT_SRC)
    p.add_argument("--src-sheet", default="Sheet1")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = p.parse_args()

    inv = load_inverse_map()
    sheet = args.src_sheet
    try:
        sheet = int(sheet)
    except (ValueError, TypeError):
        pass
    df = pd.read_excel(args.src, sheet_name=sheet, dtype=object)
    print(f"입력: {args.src.name}  {df.shape}")

    df2, log = adapt(df, inv)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    df2.to_excel(args.out, index=False)
    print(f"출력: {args.out.relative_to(ROOT)}  {df2.shape}")
    print(f"  drop(중복 .N 접미사): {len(log['dropped_dup_suffix'])} {log['dropped_dup_suffix']}")
    print(f"  drop(21회 native, 22회 삭제): {len(log['dropped_21native'])} {log['dropped_21native']}")
    print(f"  결손(22회 신규, 21회 미존재): {len(log['missing_in_21th'])} {log['missing_in_21th']}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
