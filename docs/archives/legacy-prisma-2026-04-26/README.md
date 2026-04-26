# Legacy Prisma 데이터 박제 (2026-04-26)

## 배경

`exc-survey` 는 2026-04-22 부터 점진적으로 Prisma → Supabase 이관을 진행해왔다. 마지막 잔존 도메인 (`customers`, `service_types`, `training_records`, `interviews` + 빈 0-row 테이블 7개) 는 **Sprint B Scenario A** 결정에 따라 통째로 폐기. 그 직전에 데이터를 영구 박제한다.

향후 BRIS API 연동이 본격화되면 `customers` (영업 매핑) 정보는 **다른 형태로 재구성** 될 가능성이 큼. 이 박제는 "그때 참고할 정본 스냅샷" 으로 보관한다.

## 박제 시점

- **export 일시**: 2026-04-26T00:22:33.825Z (UTC)
- **소스 DB**: Supabase 프로젝트 `cs-survey` (ref `gdwhbacuzhynvegkfoga`, region `ap-northeast-2`)
- **export 도구**: `scripts/sprint-b-export-prisma.ts` (이 PR 의 일부 — 추후 동일 export 재현 가능)

## 백업 파일 위치

**git 외부 저장소** — 본 박제는 hash·메타데이터만 git 에 추적하고 실제 데이터는 사내 저장소에 둔다 (개인정보 보호).

> 📍 **사용자 보관 위치 — 운영자가 채워 넣을 것**:
> ```
> [예: Google Drive / 회사 NAS / Dropbox 경로]
> ```

업로드 후 위치를 이 README 의 해당 줄에 적어두면, 6개월 뒤에도 누가 어디로 갔는지 추적 가능.

## 박제 파일 인벤토리

| 테이블 | rows | csv 크기 | json 크기 | 비고 |
|---|---:|---:|---:|---|
| `service_types` | 5 | 294 B | 715 B | 정적 분류표 (집체/원격교육/HRM/스마트훈련/HR컨설팅) |
| `customers` | **706** | 75 KB | 278 KB | **영업 매핑 핵심** — 회사명·영업담당자·소속팀 |
| `training_records` | 0 | 118 B | 3 B | 빈 테이블, schema 박제용 헤더만 |
| `interviews` | 0 | 176 B | 3 B | 빈 테이블 |
| `surveys` (Prisma 옛) | 0 | 140 B | 3 B | 빈 테이블 — Supabase `edu_surveys` 가 대체 |
| `survey_questions` | 0 | 91 B | 3 B | 빈 테이블 |
| `question_templates` | 0 | 71 B | 3 B | 빈 테이블 |
| `responses` | 0 | 74 B | 3 B | 빈 테이블 |
| `response_answers` | 0 | 67 B | 3 B | 빈 테이블 |
| `monthly_reports` | 0 | 112 B | 3 B | 빈 테이블 |
| `import_logs` | 0 | 105 B | 3 B | 빈 테이블 |
| **합계** | **711** | ≈ 76 KB | ≈ 278 KB | 23 파일 + `_meta.json` |

> 빈 테이블도 schema(컬럼 정의) 박제 차원에서 같이 export. CSV 헤더만 있고 본문은 비어 있음.

## 무결성 검증 (SHA-256)

다운로드 받은 파일이 박제 시점과 동일한지 확인하려면 SHA-256 해시를 비교한다.

```sh
# Linux/macOS
shasum -a 256 customers.csv
# Windows PowerShell
Get-FileHash customers.csv -Algorithm SHA256
```

다음 값들과 일치해야 함:

| 파일 | SHA-256 |
|---|---|
| `service_types.csv` | `e67dcf844b894e014909e3bff21adc4986bbb11d75ab68a2c4b99d0689fc2830` |
| `customers.csv` | `7ffabc8be95ba3a70bd169faf29c28158e86392a05f71d2c44527af8f5a1c867` |
| `training_records.csv` | `510c690a399b659cb05f20e6e833846e6e176118ae27199c03856f4977d9a886` |
| `interviews.csv` | `c2872aa3eb7402e2a71b3c083755719b1e4dd40c5cd490a9c0fd659b04da4fc1` |
| `surveys.csv` | `4467ac08799a2cb6a45e285cd8727ec80435a979781347f9413b615edc15651e` |
| `survey_questions.csv` | `45a2ea3da426bd562309c61a13aa7e26ee47fffb93fb86d8897bd1331864d5ec` |
| `question_templates.csv` | `84e4ebaf8faa627e85ba5b143a7dd1bcf0ed52db74c15b817b536a448ad70358` |
| `responses.csv` | `1a2e5178a8d3a6580cc05a46c795187572ea193b42343cb0d5bbe0a213dccc2f` |
| `response_answers.csv` | `1fd1900bec293ecc36a09739b0a04fd6dd8009f8af41a43968bd790cc7e01b34` |
| `monthly_reports.csv` | `2c5da602f97cedc8cf9ec058ca34ec3230d5b701c5cd22f0483831bd1aaf5e4d` |
| `import_logs.csv` | `1839c8bd5631400afb4a3054e2223c2b4682d6c53f8f39a53f273ee9553d08be` |

JSON 파일별 해시는 `manifest.json` 참조.

## 컬럼 의미 — `customers` (가장 가치 있는 테이블)

| 컬럼 | 타입 | 의미 | 채움률 (706건 중) |
|---|---|---|---:|
| `id` | int PK | 일련번호 | 100% |
| `company_name` | string | 회사명 | 100% |
| `service_type_id` | FK → service_types | 서비스 유형 (집체/HRM/원격) | 100% |
| `sales_rep` | string | 영업담당자 이름 | 98% (695) |
| `sales_team` | string | 소속팀 (※ 일부 메모성 텍스트 오염 ≈10건) | 92% (652) |
| `is_active` | bool | 활성 플래그 — **모두 true** | 100% |
| `created_at` | timestamp | 등록 시점 — **전부 2026-03 한 달 안** | 100% |
| `updated_at` | timestamp | 마지막 수정 — **created_at 과 동일** (수정 0건) | 100% |
| `contact_name` | string? | 담당자 이름 | **0%** |
| `contact_title` | string? | 담당자 직급 | **0%** |
| `email` | string? | 연락 이메일 | **0%** |
| `phone` | string? | 연락 전화 | **0%** |
| `eco_score` | int? | 에코 점수 (정의 미상) | **0%** |
| `notes` | string? | 메모 | **0%** |

### 데이터 본질
- "한 번 일괄 import 된 영업조직 매핑 정적 데이터"
- 등록 후 한 row 도 수정된 적 없음 → 현 시점에는 **운영 사용 중이 아님**
- 회사 ↔ 영업담당자 ↔ 팀 매핑이 핵심 정보

### 분포 (parking)
- 서비스 유형: 집체 514 (73%) / HRM 152 (22%) / 원격교육 40 (6%)
- 영업담당: 86명 (top: 정태영 42 / 김혜민 38 / 박선영 34)
- 소속팀: 30+ (top: 경기팀 100 / 서울2팀 80 / 서울3팀 74)
- 회사 단위: 662 고유 (43개 회사가 서비스유형 별 분리 등록)

### 데이터 정합성 이슈 (재현 시 주의)
- `sales_team` 컬럼에 메모성 텍스트가 일부 섞임 (예: "필기전형 진행 중\n7월 종료 예정", "X(22.12)" 등 약 10건). import 단계의 엑셀 셀 오정렬 추정.
- `contact_name`/`title`/`email`/`phone`/`eco_score`/`notes` 전부 비어있음 — 운영 입력 흔적 없음.

## `service_types` 5건

| id | name | name_en |
|---|---|---|
| 1 | 집체 | in_person |
| 2 | 원격교육 | remote |
| 3 | HRM | hrm |
| 4 | 스마트훈련 | smart_training |
| 5 | HR컨설팅 | hr_consulting |

## 향후 활용 시점 (예상 시나리오)

1. **BRIS API 본격 연동**: 외부 영업 마스터 데이터를 직접 끌어오게 되면 본 박제는 "이전엔 어떤 매핑이었나" 비교용 정본
2. **단순 lookup 필요**: 새 설문 만들 때 회사 ↔ 영업담당 표시가 필요해지면, 본 박제 customers 를 base 로 신 스키마 (Supabase 신규 테이블) 설계
3. **이력 추적 분쟁**: 어느 회사가 언제 어떤 서비스 유형으로 등록되었는지 다툼 발생 시 — `created_at` 기준 정본

## 재export 방법

본 README 와 함께 `scripts/sprint-b-export-prisma.ts` 도 git 에 보관됨. **PR-B4 의 DROP 마이그레이션 적용 전까지** 같은 스크립트로 재실행 가능. DROP 후엔 데이터 자체가 사라지므로 재export 불가.

## 관련 PR · 마이그레이션

- 본 박제 (이 README): PR-B1 = ?
- 코드 제거: PR-B2 = ?
- package.json 정리: PR-B3 = ?
- DB DROP 마이그레이션: PR-B4 = ?
- 마이그레이션 파일: `supabase/migrations/<TS>_drop_legacy_prisma_tables.sql`

(머지 후 # 번호로 갱신)
