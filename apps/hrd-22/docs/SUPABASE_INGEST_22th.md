# 22회 응답 → Supabase 적재 설계 (Track 2 — `/admin/hrd` 연결)

> 상태: **설계만** (2026-06-09). 22회 응답 수집은 6월 중순 시작 예정 — 현재 `hrd_respondents`/`hrd_responses` 의 22회분은 0행. 데이터 도착 시 본 문서대로 커넥터 구현.
>
> 목적: 파이프라인이 apihome 에서 받은 22회 응답을 Supabase 에 적재해, 배포된 `https://exc-survey.vercel.app/admin/hrd` 의 22회 대시보드·통계·응답자가 **21회처럼 실데이터로** 동작하게 한다.

## 청사진: 21회 적재 재사용

21회(48,504 응답)는 `../hrd_report_template/scripts/import_21th_all.py` (Supabase REST) 로 적재됨 (PR #139). 22회는 동일 로직을 **round_id = `40079216-9972-4bcf-8ff3-0bc296d38be9`** (year 2026) 에 맞춰 재사용한다. 22회 codebook(224 문항)은 이미 `hrd_survey_items` 에 시드됨.

## 대상 스키마 (적재 시점 기준)

**`hrd_respondents`** (round 단위 1행/응답자) — 키: `round_id` + `url_token`(또는 `biz_reg_no`+`respondent_name`)
```
respondent_name, respondent_position, respondent_email, respondent_phone/mobile,
respondent_gender, org_type, org_type_code, company_name, department_name,
industry_code, industry_name, biz_reg_no, address_road/detail, zipcode, recommender,
status(='완료'만 적재 — tesmi_status=10), source, completed_at
```
**`hrd_responses`** (응답자 × 문항 = 다행) — 키: `respondent_id` + `item_id`(+ `round_id`)
```
value_text | value_number | value_json  ← answer_type 에 따라 정확히 하나만 채움
```
**`hrd_survey_items`** — 조인 키: `item_code`. 파이프라인 codebook(`config/codebook_patch_22th.yaml`, `config/raw_export_columns_22th.json`)이 raw 컬럼 → `item_code` 매핑을 보유. 적재 시 item_code → item_id 해석.

## `cast_value()` answer_type 분기 (PR #139 검증 스펙 그대로)

| 컬럼 suffix / answer_type | 적재 컬럼 |
|---|---|
| `_etc` | `value_text` |
| `_2` + currency/number/percent | `value_number` (비숫자는 `value_text` fallback) |
| `_3` / `_4` + percent / likert_5 | `value_number` |
| `_multi` (multiple_choice) | `value_json` (예: `[1,4]`) |
| `_multi` (single_choice) | `value_text` |
| `_che` / `_cheOrder` | `value_json` (csv 분해) |

> 21회 실데이터 검증: multi 7,304행 모두 `value_json`, likert/currency/number/percent 35,139행 모두 `value_number`.

## 커넥터 흐름

1. **소스 로드** — `fetch_raw.py` 가 만든 `1_raw/...All.xlsx`(apihome 재현) 또는 정제본 `3_cleaned/All_확인완료_22th.xlsx`. 각 행 = 응답자 1명 + 다수 답.
2. **응답자 upsert** — `round_id=22회` 로 identity/org 필드 매핑, `tesmi_status=10('완료')` 만 적재, `source='apihome'`.
3. **응답 upsert** — 답 컬럼별 → `item_code` 해석 → `item_id`; `answer_type` 으로 `cast_value` → `value_*`; `(respondent_id, item_id, round_id)` upsert.

## 결정 1건 (수집 시작 시점에 확정)

**적재 소스 단계** — raw vs cleaned:
- **raw(1_raw) 주기 적재**: 수집 중에도 `/admin/hrd` 가 실시간 응답 추이를 보여줌. 단 미정제(이상치 포함).
- **cleaned(3_cleaned) 최종 적재**: 리포트와 대시보드 수치가 일치. 단 분석가 검수 후라 늦음.
- 권장: **둘 다** — 수집 중 raw 주기 적재(모니터링) → 검수 완료 후 cleaned 로 재적재(확정). `source`/`status` 로 구분.

## 구현 시 체크리스트

- [ ] `import_21th_all.py` 를 `apps/hrd-22/scripts/` 로 가져와 22회 round_id·codebook 매핑으로 어댑트 (`stageX_ingest_supabase.py`)
- [ ] Supabase 접속: service-role 키는 `creds/` 또는 env (레포 커밋 금지). cs-master 와 동일 패턴.
- [ ] item_code 매핑 정합 검증: 파이프라인 codebook ↔ `hrd_survey_items.item_code` 누락/불일치 0건
- [ ] 멱등 upsert (`on conflict (respondent_id,item_id)`), 재적재 시 중복 0
- [ ] 적재 후 `/admin/hrd?round=22` 대시보드·통계 표시 확인
