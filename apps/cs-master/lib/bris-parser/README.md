# bris-parser

BRIS(사내 교육관리 시스템) HTML 응답을 구조화된 JSON으로 파싱하는 순수 함수 라이브러리.

## 제공 함수

### 페이지 파서 (HTML → JSON)
| 함수 | 입력(HTML) | 출력 |
|------|-----------|------|
| `extractIntegratedData(html)` | `/business/complain_reference_list.asp` | 과정 레코드 배열 |
| `extractEduDetailData(html)` | `/business/education_view.asp` | 과정 상세 객체 |
| `extractEchoviewData(html)` | `/business/echo/project_echoview.asp` | 에코 프로젝트 객체 |
| `extractEchoData(html)` | `/business/echo/operate/main_2024.asp` | 운영 + 다차수 일정 |
| `extractProjectDetailData(html)` | `/business/success/project_view.asp` | 프로젝트 객체 |
| `extractProjectBizList(html)` | `/business/success/project_biz_list.asp` | 차수 배열 |
| `extractDmData(html)` | `/dm/dm_view.asp` | 고객 담당자 객체 |

### 유틸
- `normalizeText(str)` — NBSP/전각 공백 제거
- `normalizeDate(str)` — `YYYYMMDD` → `YYYY-MM-DD`
- `parseBrisDate(str)` — `"2025/04/23~30"` → `{startDate, endDate}`
- `normalizePhone(raw)` — 전화번호 하이픈 포맷
- `normalizeTeamName(raw)` — 팀 코드 prefix 제거
- `extractLabelValues(row)` — `<span><b>label:</b>value</span>` 일괄 dict
- `genId()`, `esc(str)`

## 사용법

### 브라우저
```html
<script src="./dist/bris-parser.iife.js"></script>
<script>
  const records = BrisParser.extractIntegratedData(htmlString);
</script>
```

### Node (ESM)
```js
import { DOMParser } from 'linkedom';
import { setDOMParser, extractIntegratedData } from 'bris-parser';
setDOMParser(DOMParser);

const records = extractIntegratedData(htmlString);
```

### Node (CommonJS)
```js
const { DOMParser } = require('linkedom');
const { setDOMParser, extractIntegratedData } = require('bris-parser');
setDOMParser(DOMParser);
```

## 빌드 / 테스트
```sh
npm install
npm run build   # dist/ 3종 생성
npm test        # 합성 픽스처 + test/fixtures/real/ 실 데이터
```

## 파싱 규칙 요약
상세는 `C:\Users\EXC\.claude\plans\tranquil-imagining-kahan.md` 참조. 핵심:
- 통합 페이지는 **메인 행 + info-row N개** 단위, info-row 는 **라벨 기반 분기**로 파싱 (사내강사/외부강사 분리 지원)
- 모든 파서는 텍스트 정규화(`normalizeText`) 적용
- 날짜는 ISO 8601 (`YYYY-MM-DD`)로 통일
- 전화번호는 `normalizePhone`으로 하이픈 포맷 통일

## 실 데이터 회귀
1. BRIS 응답 HTML을 `test/fixtures/real/<kind>_<yyyymmdd>.html`로 저장
2. 매칭되는 `.expected.json` 파일 작성 (또는 최초 실행 결과 저장)
3. `npm test` 로 상시 검증
