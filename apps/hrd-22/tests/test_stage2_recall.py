"""[검증] 21회 raw 의 21건 정정 사례가 자동 플래그에 포함되는지 recall 측정.

KPI: 21회 raw → cleaned 사이 단위 보정 21건 / outlier_report 의 flags ⊇ 정정 케이스
"""
from pathlib import Path
import pandas as pd
import sys, io, re
if __name__ == "__main__" and sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "reference/21th_raw.xlsx"
CLEAN = ROOT / "reference/21th_cleaned.xlsx"
OUTLIER = ROOT / "workspace/test_outlier_21th.xlsx"
REPORT = ROOT / "tests/test_stage2_report.md"

# 1) 정정 케이스 추출 (raw vs cleaned)
raw = pd.read_excel(RAW, sheet_name=0, dtype=object)
clean = pd.read_excel(CLEAN, sheet_name="Sheet1", dtype=object)
raw["_st"] = raw["tesmi_status"].astype(str).map(lambda v: re.sub(r"<[^>]+>", "", v).strip())
raw_c = raw[raw["_st"] == "완료"].reset_index(drop=True)

# 매칭 키
key_cols = ["R_Company_Name", "R_Part_Name", "p1)R_1_2_2"]
raw_c["_key"] = raw_c[key_cols].astype(str).agg("_".join, axis=1)
clean["_key"] = clean[key_cols].astype(str).agg("_".join, axis=1)
raw_idx = raw_c.set_index("_key")
clean_idx = clean.set_index("_key")
overlap = set(raw_idx.index) & set(clean_idx.index)

def num(v):
    if v is None: return None
    try: return float(str(v).strip().replace(",", ""))
    except: return None

target_cols = ["p1)R_1_1_2", "p1)R_1_5_2"]
corrections = []
for col in target_cols:
    for k in overlap:
        rv = raw_idx.loc[k, col]; cv = clean_idx.loc[k, col]
        if hasattr(rv, "iloc"): rv = rv.iloc[0]
        if hasattr(cv, "iloc"): cv = cv.iloc[0]
        rn = num(rv); cn = num(cv)
        if rn != cn and not (rn is None and cn is None):
            # 정정 케이스
            corrections.append({
                "col": col,
                "key": k,
                "raw": rn,
                "clean": cn,
                "company": raw_idx.loc[k, "R_Company_Name"] if not hasattr(raw_idx.loc[k, "R_Company_Name"], "iloc") else raw_idx.loc[k, "R_Company_Name"].iloc[0],
            })

print(f"정정 케이스: {len(corrections)}건")

# 2) 자동 플래그 결과 로드
flags = pd.read_excel(OUTLIER, sheet_name="flags")
print(f"자동 플래그: {len(flags)}건")

# 3) 매칭: 정정 케이스의 (company, col) 이 플래그에 있는지
recall_hits = []
for cor in corrections:
    # raw_c 에서 해당 응답자의 row_idx 찾기
    row_in_raw_c = raw_c[raw_c["_key"] == cor["key"]]
    if row_in_raw_c.empty:
        continue
    row_idx = row_in_raw_c.index[0]

    # 응답자 단위로 플래그됐는지 (직접 컬럼 매칭 + cross_column 모두 포함)
    matching = flags[flags["row_idx"] == row_idx]
    # 정확히 그 컬럼 직접 플래그
    direct = matching[matching["column"] == cor["col"]]
    # cross_column 플래그 (해당 컬럼이 expression 에 포함)
    cross = matching[matching["column"].astype(str).str.contains(cor["col"], regex=False)]
    all_match = pd.concat([direct, cross]).drop_duplicates(subset=["rule_id", "row_idx"])
    found = len(all_match) > 0
    recall_hits.append({
        "company": cor["company"],
        "col": cor["col"],
        "raw": cor["raw"],
        "clean": cor["clean"],
        "flagged": "✓" if found else "✗",
        "rule_ids": ",".join(all_match["rule_id"].astype(str).tolist()) if found else "",
    })

# Recall 계산
df = pd.DataFrame(recall_hits)
recall = (df["flagged"] == "✓").sum() / len(df) * 100 if len(df) else 0
print(f"\nRecall: {(df['flagged'] == '✓').sum()}/{len(df)} ({recall:.0f}%)")

# Report
report_lines = [
    "# 단계 2 이상치 플래그 — 21회 reverse-run 검증",
    "",
    f"**Recall (정정 사례가 자동 플래그됨)**: {(df['flagged'] == '✓').sum()}/{len(df)} ({recall:.0f}%)",
    "",
    "**KPI 해석**: 21회 raw 에서 분석가가 단위 보정한 21건이 자동 이상치 플래그에 모두 포함되는가?",
    "",
    "## 정정 케이스별 recall",
    "",
    "| 회사 | 컬럼 | raw | clean | 플래그 | 적용된 규칙 |",
    "|---|---|---:|---:|:---:|---|",
]
for _, r in df.iterrows():
    company = str(r["company"])[:20]
    raw_v = f"{r['raw']:.2e}" if abs(r["raw"]) > 1e5 else f"{r['raw']:.0f}"
    clean_v = f"{r['clean']:.2e}" if abs(r["clean"]) > 1e5 else f"{r['clean']:.0f}"
    report_lines.append(f"| {company} | {r['col']} | {raw_v} | {clean_v} | {r['flagged']} | {r['rule_ids']} |")

report_lines.append("")
report_lines.append("## 미감지 케이스 분석")
report_lines.append("")
missed = df[df["flagged"] == "✗"]
if len(missed):
    for _, r in missed.iterrows():
        report_lines.append(f"- **{r['company']}** ({r['col']}): raw={r['raw']:.2e} → clean={r['clean']:.2e}")
        # 왜 안 잡혔나? raw 값 분석
        v = r["raw"]
        if r["col"] == "p1)R_1_1_2":
            if v >= 100_000_000 and v <= 1_000_000_000_000_000:
                report_lines.append(f"  - 매출 범위 내 (1억~1000조) — 규칙 미적용. 비율 규칙 cross_column 으로 잡아야 했음")
        elif r["col"] == "p1)R_1_5_2":
            if v >= 1_000_000 and v <= 100_000_000_000:
                report_lines.append(f"  - 예산 범위 내 (100만~1000억) — 규칙 미적용")
else:
    report_lines.append("(없음)")

REPORT.write_text("\n".join(report_lines), encoding="utf-8")
print(f"\n리포트: {REPORT}")
