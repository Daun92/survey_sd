# bris-parser (Python) — v0.2.0

BRIS HTML 파서. JS 라이브러리(`lib/bris-parser`)와 **1:1 동등성 보장**.

## 지원 파서

| 함수 | BRIS 페이지 | 출력 |
|------|------------|------|
| `parse(html)` | 통합 (`complain_reference_list.asp`) | 한글 키 dict 리스트 |
| `parse_as_camelcase(html)` | 통합 | camelCase 키 (JS 동등) |
| `extract_edu_detail_data(html)` | 교육세부 (`education_view.asp`) | camelCase dict |
| `extract_echoview_data(html)` | 에코현황 (`echo/project_echoview.asp`) | camelCase dict |
| `extract_echo_data(html)` | 에코운영 (`echo/operate/main_2024.asp`) | camelCase + schedules[] |
| `extract_project_detail_data(html)` | 프로젝트세부 (`project_view.asp`) | camelCase dict |
| `extract_project_biz_list(html)` | 교육내역 목록 (`project_biz_list.asp`) | sessions[] + totalCount |
| `extract_dm_data(html)` | DM 상세 (`dm_view.asp`) | camelCase dict |

## 공통 유틸 (`bris_parser.utils`)

- `normalize_text(s)` — NBSP/전각/ZWB → 일반 공백
- `normalize_date(s)` — `YYYYMMDD` → `YYYY-MM-DD`
- `parse_bris_date(s)` — `"2025/04/23~05/30"` → `{startDate, endDate}`
- `normalize_phone(raw)` — 하이픈 포맷 (02/휴대/일반)
- `normalize_team_name(raw)` — 팀 코드 prefix 제거
- `esc(s)`, `gen_id()`

## 설치

```sh
pip install -e .[dev]
```

## 사용법

### 한글 키 (bris_to_supabase.py 호환)

```python
from bris_parser import parse
records = parse(html_content)
# → [{'과정명': '...', '사내강사': '...', '수주_담당자': '...', ...}]
```

### camelCase 키 (JS 동일 스키마)

```python
from bris_parser import (
    parse_as_camelcase,
    extract_edu_detail_data, extract_echoview_data,
    extract_echo_data, extract_dm_data,
    extract_project_detail_data, extract_project_biz_list,
)

integrated = parse_as_camelcase(html)       # [{courseName, internalInstructors, ...}]
edu = extract_edu_detail_data(html)         # {businessId, orderCode, instructors, ...}
dm = extract_dm_data(html)                  # {customerId, name, phone, mobile, ...}
```

## 테스트

```sh
python -m pytest -v
```

**공통 픽스처 공유** — `../bris-parser/test/fixtures/`의 HTML + `.expected.json`을 JS/Python 양쪽에서 사용. JS `expected.json`이 Single Source of Truth, Python은 동일 결과를 반환함을 assert.

- `test_utils.py` (6) — 정규화 유틸 단위
- `test_parser.py` (4) — 통합 페이지 한글 키 검증
- `test_equivalence.py` (3) — 통합 페이지 JS 동등성
- `test_edu_detail.py`, `test_echo_view.py`, `test_echo_data.py`, `test_dm.py` (각 1)
- `test_project.py` (2) — project_detail + project_biz_list

## JS 파서와의 호환

- 통합 페이지의 한글 키 출력: `bris_api.py`, `bris_to_supabase.py`와 하위호환
- 나머지 7개 파서: **camelCase 직접 출력** (JS와 동일)
- 각 BRIS 페이지 구조 변경 시 **`expected.json` 한 곳만 수정** → JS/Python 양쪽 자동 회귀
