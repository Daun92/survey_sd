# 김태웅 버전 정제·집계 프로세스 + 관리 GUI 설계

> 작성: 2026-05-20 · 상태: **설계 확정 / 구현 보류**
> 결정 사항: 독립 경량 로컬앱(1인) · 작업대+상태판 동등 · 프레임워크 미확정
> 배경: 21회 305→206은 분석가 수기 black box였음([[POPULATION_FILTER_ANALYSIS_21th]]). 이를 추적가능한 프로세스로 전환.

## 1. 설계 원칙 — 결정 원장이 단일 진실원

```
raw_22th.xlsx (불변 원본)
        +
decisions_22th.yaml (분석가 결정 원장 = SINGLE SOURCE OF TRUTH)
        │  앱이 결정을 raw에 적용(idempotent)
        ▼
All_확인완료_22th.xlsx (정제 DB = 파생 스냅샷, 언제든 재생성 가능)
        │  기존 stage4_build_kim_xlsx.py + stage4_extract_chart_data.py(신규)
        ▼
김태웅_22th.xlsx (16시트) + chart_data_22th.json
```

- **정제 DB를 직접 손대지 않는다.** 모든 변경은 decisions 원장을 거친다 → 누가·무엇을·왜가 100% 남음.
- 재생성이 멱등(idempotent): raw + 같은 decisions → 항상 같은 정제 DB.
- 21회 대비 차이: 작년엔 정제 DB를 수기 편집(흔적 소실). 올해는 결정만 기록하고 산출물은 파생.

## 2. 식별자 — 행 단위(resp_id) vs 조직 단위(org_key) 분리 [확정]

21회 확인완료 실측: 사업자번호 305건 중 **302건(99%) 채워짐**, `tesmi_regdate` 존재.
단 사업자번호는 **조직당 여러 건**(8개 조직이 담당자 2명씩 응답) → 행 고유키가 아니다. 두 키를 분리한다.

| 키 | 용도 | 규칙 |
|---|---|---|
| **`resp_id`** | 행(응답) 단위 — 결정을 묶는 키 | ingest 시 `R%04d` 부여 + `(사업자번호, 담당자명, regdate)` 해시로 `resp_id_map_22th.csv`에 고정 → raw 재export에도 안정 |
| **`org_key`** | 조직 단위 — 중복 판정 | 사업자번호 우선, 공란 시 회사명 정규화(공백·법인격 제거) 폴백 |

- 사업자번호 공란(21회 3건)은 회사명 정규화로 org_key 생성, 그래도 모호하면 작업대에서 분리 응답으로 처리.

## 3. decisions_22th.yaml 스키마

```yaml
meta:
  round: 22
  raw_source: "1_raw/raw_22th.xlsx"
  raw_rowcount: 0          # ingest 시 기록
  created: "2026-08-..T..:.."
  last_updated: "..."
decisions:
  # (A) 단위·값 보정
  - id: D0001
    resp_id: R0042
    type: correction
    field: "p1)R_1_1_2"     # 대상 컬럼(매출)
    before: 5000
    after: 500000000000
    rule: "unit_x1e8"        # correction_patterns.yaml 패턴 ID 또는 "manual"
    reason: "매출 단위 오기(억→원)"
    source: "outlier_report#row12"   # 또는 "manual"
    decided_by: "analyst"
    decided_at: "2026-08-..T..:.."

  # (B) 포함/제외
  - id: D0002
    resp_id: R0108
    type: exclusion
    excluded: true
    reason: "테스트 응답(사내 계정)"
    source: "manual"
    decided_by: "analyst"
    decided_at: "..."

  # (C) 업종 재분류
  - id: D0003
    resp_id: R0077
    type: reclassification
    field: "R_Cate"
    before: "etc"           # 또는 소수업종 코드
    after: "9"              # IT/Software
    after_label: "IT/Software"
    reason: "R_Cate_Name='클라우드 솔루션' → IT 귀속"
    source: "manual"
    decided_by: "analyst"
    decided_at: "..."
```

- 한 응답자에 여러 결정 가능(보정 N + 재분류 1 + 제외 0).
- `type`별 필수 필드: correction=field/before/after, exclusion=excluded, reclassification=field/before/after.
- 공통 감사 필드: id·resp_id·reason·source·decided_by·decided_at.

## 4. corrections_log.xlsx (사람용 내보내기)

decisions를 평면화한 표. 21회 `corrections_log.xlsx`와 호환 컬럼:

| resp_id | 회사명 | 결정유형 | 대상필드 | 변경전 | 변경후 | 사유 | 출처 | 일시 |
|---|---|---|---|---|---|---|---|---|

- 앱의 "이력" 탭에서 한 번에 export. 보고/검수용.

## 5. 모집단 확정 공식 + 상태판 카운트

```
N_raw          = raw 전체 행
N_완료         = tesmi_status=완료
N_dedup        = N_완료 − 중복 제거(org_key 그룹당 1건; §7-3)
N_핵심유효     = 핵심지표(직원수·교육예산 등) 유효 행
N_모집단(확정) = N_핵심유효 − exclusion(excluded=true)
```

상태판 표시:
- 수 추이 막대: raw → 완료 → dedup → 모집단
- **미결 건수**: outlier_report 후보 중 결정(승인/보정/무시) 안 된 행
- 산출물 신선도: 김태웅/chart_data가 최신 decisions 반영했는지(타임스탬프 비교)
- 단계 진행률: progress.yaml 연동

## 6. 화면 구성 (작업대 + 상태판)

| 탭 | 기능 | 읽기 | 쓰기 |
|---|---|---|---|
| 상태판 | 진행률·수추이·미결·신선도 | progress.yaml, raw, decisions | — |
| 이상치 검토 | outlier_report 행별 승인/보정/무시 | outlier_report.xlsx | decisions(correction) |
| 업종 재분류 | etc·소수업종 → 표준 라벨 매핑 | raw, segments.yaml | decisions(reclassification) |
| 포함/제외 | excluded 토글 + 실시간 N | raw, decisions | decisions(exclusion) |
| 산출/미리보기 | 재생성 트리거 + 요약 | — | 김태웅/chart_data 호출 |
| 이력 | 결정 원장 + corrections_log export | decisions | corrections_log.xlsx |

## 7. 확정된 결정 (2026-05-20)

1. **프레임워크 = FastAPI + HTMX/Jinja.** 상주 서버 + HTMX 부분 갱신. 단계 2 골격은 라우트 + base 템플릿 + HTMX 세팅 포함.
2. **식별자 = resp_id(행) / org_key(조직) 분리** (§2 확정).
3. **중복 제거 = 조직 1건 자동추천 + 수기 override.** org_key 그룹에서 **완성도(p채움) 최대 → 동률 시 최신 regdate**로 1건 자동 추천, 작업대에서 분석가가 확인·변경. R_Div 등 **분류 불일치 그룹은 '검토 필요' 플래그**(예: 21회 인천공항시설관리 Div 2 vs 4). 비선택 응답은 제외가 아니라 `dedup_dropped` 표시(추적 유지).
4. **업종 재분류 → 주요업종 선정 순서 고정.** 이상치보정 → 제외 → **업종 재분류 확정 → 모집단 확정 → 주요업종 선정**. 선정 규칙 = **재분류 후 카운트 ≥10 자동 추천 + 수기 확정**(임계 10, 고정 개수 아님). [[SEGMENT_RULE_VERIFICATION_21th]] 연동.
5. **집계 방식 = 코드북 자동추론 + chart_specs override** (§9).

## 8b. 추가 산출물 (미작성, 빌드 대상)
- `scripts/stage4_extract_chart_data.py` — chart_specs + 정제 DB → `chart_data_22th.json` (§9). 산출 탭 트리거 대상.

## 8. 빌드 단계 (할 일 단위 · 선후)

```
1. 결정 데이터 모델 확정          → decisions 스키마 + resp_id 부여기   ★본 문서에서 설계 완료
2. 앱 골격 + 상태판              → 실행되는 앱, 수추이·미결 표시
   ├─ 3. 이상치 검토 화면         → 후보 테이블 + 액션
   ├─ 4. 업종 재분류 화면         → 매핑 UI                (3·4·5 병렬)
   └─ 5. 포함/제외 화면           → 토글 + 실시간 N
6. 산출 트리거 + 미리보기         → stage4 + chart_data 호출
7. 감사 이력 + 내보내기           → corrections_log export
```

순서: 1 → 2 → (3·4·5 병렬) → 6 → 7.
- 단계 1은 본 문서로 설계 확정. 단계 2는 FastAPI 골격(라우트 + Jinja base + HTMX). 구현은 raw 도착 전 도구 선제작 가능.

## 9. 집계 방식 — 코드북 자동추론 + override [확정]

`stage4_extract_chart_data.py`는 변수별 집계법을 **코드북 `응답방식` + 변수 접미사로 자동 추론**하고, 예외만 `chart_specs.yaml`의 서브차트에 `agg:` 키로 덮어쓴다.

| 추론 조건(접미사/응답방식) | 집계법 `agg` | 출력 |
|---|---|---|
| `_2` 숫자(금액·인원·시간) | `mean` | 세그먼트별 평균 |
| `_3`/`_4` 비율(%) | `mean_pct` | 평균 비율(합100 검증) |
| `_multi` 단일선택 / `_rad` | `dist` | 보기값 분포(%) |
| `_multi` 복수응답 | `multi_rate` | 보기값별 응답률 |
| `_1_2`등 1~5 리커트 | `likert` | 평균 + 1~5 분포 |
| `_che`/`_cheOrder` 순위 | `rank` | 항목별 순위 점수 |

- 단일/복수 `_multi` 구분은 코드북 응답방식 텍스트(단일선택 vs 다중응답)로 판정.
- override 예: 거시지표 도표는 세부제목별로 단일 변수 + `agg: mean` 명시(현 chart_specs는 R_1 5변수가 묶여 있어 정밀화 필요).
- 출력 `chart_data_22th.json` 구조(안):
  ```json
  {"chart_id": 5, "sub": "교육예산 총액", "agg": "mean",
   "segments": {"전체": 312000000, "1000이상": 540000000, "공공": 280000000}}
  ```
