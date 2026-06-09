"""원천 데이터 자동 다운로드 — apihome API → 1_raw xlsx (수동 다운로드와 동일 포맷).

연구 admin 화면의 'All.xlsx' 버튼은 아래 JSON API 를 받아 브라우저에서 xlsx 를 만든다.
본 스크립트는 그 과정을 서버측에서 재현한다.

  GET https://apihome.exc.co.kr/api/expert/admin/answer/data/hrd_2026/all   (인증 불필요)
    → {code:200, data:{store_data_list:[...278필드...], top_menu_list, tesci_name}}
    → store_data_list 를 DataFrame 화
    → 수동 export 컬럼 순서(config/raw_export_columns_22th.json, 243개)로 정렬·추출
    → 1_raw/제 22회 인재개발 실태조사_All.xlsx 덮어쓰기 (stage2 이하 파이프라인이 그대로 읽음)

주의: 응답에 개인정보(이름·이메일·전화)가 포함되므로 값은 로그에 출력하지 않는다.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
API_URL = "https://apihome.exc.co.kr/api/expert/admin/answer/data/hrd_2026/all"
DEFAULT_TEMPLATE = ROOT / "config" / "raw_export_columns_22th.json"
DEFAULT_OUT = ROOT / "1_raw" / "제 22회 인재개발 실태조사_All.xlsx"

# tesmi_status 는 API 가 코드로 주고(0/10), 수동 export 는 브라우저가 HTML 라벨로 변환한다.
# stage2 가 태그 제거 후 '완료' 로 매칭하므로 평문 라벨로 매핑(태그 불필요·더 깔끔). 미지 코드는 그대로 두어 미완료 처리.
STATUS_MAP = {0: "설문중", 10: "완료"}

# 브라우저와 동일 헤더 (서버가 Origin/Referer 를 검사할 수 있어 포함). 자격증명은 없음.
HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "origin": "https://research.exc.co.kr",
    "referer": "https://research.exc.co.kr/",
    "user-agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/146.0.0.0 Whale/4.37.378.12 Safari/537.36"),
}


def fetch_json(url: str, timeout: int = 60) -> dict:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:   # noqa: S310 (신뢰된 사내 API)
        body = r.read().decode("utf-8")
    return json.loads(body)


def build_dataframe(payload: dict, template_cols: list[str]) -> tuple[pd.DataFrame, list[str]]:
    if payload.get("code") != 200:
        raise RuntimeError(f"API code={payload.get('code')} (200 아님)")
    recs = (payload.get("data") or {}).get("store_data_list")
    if not recs:
        raise RuntimeError("store_data_list 가 비어있음")
    df = pd.DataFrame(recs)
    missing = [c for c in template_cols if c not in df.columns]
    if missing:
        raise RuntimeError(f"export 템플릿 컬럼 {len(missing)}개가 API 응답에 없음: {missing[:10]}")
    out = df[template_cols].copy()
    # tesmi_status 코드 → 라벨 (수동 export 재현; stage2 완료필터 호환)
    if "tesmi_status" in out.columns:
        codes = set(pd.to_numeric(out["tesmi_status"], errors="coerce").dropna().astype(int))
        unknown = sorted(codes - set(STATUS_MAP))
        out["tesmi_status"] = out["tesmi_status"].map(
            lambda v: STATUS_MAP.get(int(v) if str(v).strip().lstrip("-").isdigit() else v, v)
        )
        if unknown:
            print(f"[fetch_raw] ⚠ 미정의 tesmi_status 코드 {unknown} — STATUS_MAP 갱신 검토(현재 미완료 처리)")
    return out, []


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--url", default=API_URL)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE)
    args = ap.parse_args()

    template_cols = json.loads(args.template.read_text(encoding="utf-8"))
    payload = fetch_json(args.url)
    df, new_q = build_dataframe(payload, template_cols)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(args.out, index=False)

    n = len(df)
    done = int((df["tesmi_status"].astype(str) == "완료").sum()) if "tesmi_status" in df.columns else -1
    print(f"[fetch_raw] {n}건 (완료 {done}) → {args.out.name}")
    if new_q:
        print(f"[fetch_raw] ⚠ 템플릿에 없는 신규 설문 필드 {len(new_q)}개 — 설문 변경 가능, 템플릿 갱신 검토: {new_q[:10]}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
