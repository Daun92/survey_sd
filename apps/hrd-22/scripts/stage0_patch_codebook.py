"""[단계 0] 21회 codebook → 22회 codebook patch.

config/codebook_patch_22th.yaml 의 변경 사양을 21회 codebook 에 적용.

입력:
  - reference/21th_cleaned.xlsx 의 '코드표'·'HRD이슈_항목코드' 시트
  - config/codebook_patch_22th.yaml

출력:
  - 0_survey/codebook_22th.xlsx (코드표 + HRD이슈_항목코드 두 시트)
  - 0_survey/codebook_patch_report.md (적용 요약)
"""
from __future__ import annotations
import argparse
import io
import sys
from pathlib import Path

import pandas as pd

try:
    import yaml
except ImportError:
    sys.exit("pyyaml 미설치 — pip install pyyaml")

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "reference/21th_cleaned.xlsx"
PATCH_YAML = ROOT / "config/codebook_patch_22th.yaml"
OUT_XLSX = ROOT / "0_survey/codebook_22th.xlsx"
OUT_REPORT = ROOT / "0_survey/codebook_patch_report.md"


COL_NAMES = ["컬럼코드", "Part", "설문문항", "하위항목", "응답형식"]


def apply_patch(cb: pd.DataFrame, patch: dict) -> tuple[pd.DataFrame, list[str]]:
    """변경 사양 적용. 적용 로그 동시 반환."""
    log: list[str] = []

    # 1) drop
    for col in patch.get("drop", []):
        before = len(cb)
        cb = cb[cb["컬럼코드"] != col].reset_index(drop=True)
        log.append(f"[drop] {col} ({before - len(cb)}건 제거)")

    # 2) rename_sub_item
    for r in patch.get("rename_sub_item", []):
        col = r["col"]
        new = r["new_sub_item"]
        mask = cb["컬럼코드"] == col
        if not mask.any():
            log.append(f"[rename_sub_item] [WARN] {col} 없음")
            continue
        old = cb.loc[mask, "하위항목"].iloc[0]
        cb.loc[mask, "하위항목"] = new
        log.append(f"[rename_sub_item] {col}: {old!r} → {new!r}")

    # 3) update_response_format
    for r in patch.get("update_response_format", []):
        col = r["col"]
        new = r["new_response_format"]
        mask = cb["컬럼코드"] == col
        if not mask.any():
            log.append(f"[update_response_format] [WARN] {col} 없음")
            continue
        old = cb.loc[mask, "응답형식"].iloc[0]
        cb.loc[mask, "응답형식"] = new
        log.append(f"[update_response_format] {col}: {old[:40]}... → {new[:40]}...")

    # 4) replace_block (prefix 매칭 후 제거 → 새 컬럼 append)
    for r in patch.get("replace_block", []):
        prefix = r["prefix"]
        before = len(cb)
        cb = cb[~cb["컬럼코드"].astype(str).str.startswith(prefix)].reset_index(drop=True)
        removed = before - len(cb)
        log.append(f"[replace_block] prefix={prefix!r}: {removed}컬럼 제거")

        for new_col in r.get("new_columns", []):
            row = {c: new_col.get(c.lower().replace("코드", "col")
                                  .replace("Part", "part")
                                  .replace("설문문항", "question")
                                  .replace("하위항목", "sub_item")
                                  .replace("응답형식", "response_format"))
                   for c in COL_NAMES}
            # 직접 매핑이 복잡하므로 명시:
            row = {
                "컬럼코드": new_col.get("col"),
                "Part": new_col.get("part"),
                "설문문항": new_col.get("question"),
                "하위항목": new_col.get("sub_item"),
                "응답형식": new_col.get("response_format"),
            }
            cb = pd.concat([cb, pd.DataFrame([row])], ignore_index=True)
            log.append(f"[replace_block] + {row['컬럼코드']} ({row['하위항목']})")

    # 5) add (신규 컬럼 append)
    for new_col in patch.get("add", []):
        row = {
            "컬럼코드": new_col.get("col"),
            "Part": new_col.get("part"),
            "설문문항": new_col.get("question"),
            "하위항목": new_col.get("sub_item"),
            "응답형식": new_col.get("response_format"),
        }
        cb = pd.concat([cb, pd.DataFrame([row])], ignore_index=True)
        log.append(f"[add] + {row['컬럼코드']} ({row['하위항목']})")

    return cb, log


def apply_hrd_issue_mapping(df: pd.DataFrame, mappings: list[dict]) -> tuple[pd.DataFrame, list[str]]:
    """HRD이슈_항목코드 시트의 항목명 교체."""
    log: list[str] = []
    if df is None or df.empty or not mappings:
        return df, log
    # 두 번째 열이 항목명 (보통). 헤더로 확인
    name_col = None
    for c in df.columns:
        if str(c).strip() in ("항목명", "항목", "이름"):
            name_col = c
            break
    if name_col is None and len(df.columns) >= 2:
        name_col = df.columns[1]
    for m in mappings:
        old, new = m["old"], m["new"]
        mask = df[name_col].astype(str).str.contains(old.split("(")[0][:10], regex=False, na=False)
        # 더 엄격하게: 정확 일치 우선
        exact = df[name_col].astype(str) == old
        if exact.any():
            mask = exact
        if not mask.any():
            log.append(f"[hrd_issue] [WARN] '{old}' 없음")
            continue
        df.loc[mask, name_col] = new
        log.append(f"[hrd_issue] '{old}' → '{new}' ({mask.sum()}건)")
    return df, log


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", type=Path, default=SRC)
    parser.add_argument("--patch", type=Path, default=PATCH_YAML)
    parser.add_argument("--out", type=Path, default=OUT_XLSX)
    parser.add_argument("--report", type=Path, default=OUT_REPORT)
    args = parser.parse_args(argv)

    if not args.src.exists():
        sys.exit(f"21회 codebook 없음: {args.src}")
    if not args.patch.exists():
        sys.exit(f"patch yaml 없음: {args.patch}")

    cb = pd.read_excel(args.src, sheet_name="코드표")
    issue = pd.read_excel(args.src, sheet_name="HRD이슈_항목코드")
    patch = yaml.safe_load(args.patch.read_text(encoding="utf-8"))

    n_before = len(cb)
    cb_new, log_cb = apply_patch(cb, patch)
    issue_new, log_issue = apply_hrd_issue_mapping(issue, patch.get("hrd_issue_mapping", []))

    # Output
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(args.out, engine="openpyxl") as w:
        cb_new.to_excel(w, sheet_name="코드표", index=False)
        issue_new.to_excel(w, sheet_name="HRD이슈_항목코드", index=False)

    # Report
    report = [
        "# 22회 codebook patch 적용 리포트",
        "",
        f"> 원본: `{args.src.name}` → 출력: `{args.out.relative_to(ROOT)}`",
        f"> patch 사양: `{args.patch.relative_to(ROOT)}`",
        "",
        f"- 21회 codebook: {n_before}컬럼",
        f"- 22회 codebook: {len(cb_new)}컬럼",
        f"- 차이: {len(cb_new) - n_before:+d}",
        "",
        "## 적용 내역",
        "",
    ]
    for line in log_cb + log_issue:
        report.append(f"- {line}")
    report.append("")
    report.append("## 22회 codebook 미리보기 (마지막 30행)")
    report.append("")
    report.append(cb_new.tail(30).to_string())

    args.report.write_text("\n".join(report), encoding="utf-8")

    print(f"21회 → 22회 codebook: {n_before} → {len(cb_new)} (Δ {len(cb_new) - n_before:+d})")
    print(f"  변경 {len(log_cb)}건 (코드표) + {len(log_issue)}건 (HRD이슈)")
    print(f"\n출력:")
    print(f"  - {args.out.relative_to(ROOT)}")
    print(f"  - {args.report.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
