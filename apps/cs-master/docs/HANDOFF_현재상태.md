# CS 대상자 관리 시스템 — 현재 상태 핸드오프

작성일: 2026-04-15
목적: Claude Code에서 기존 Vercel + Supabase 프로젝트 위에 Notion 연동(또는 자체설문 페이지)을 이어붙일 때 필요한 맥락을 한 페이지로 정리.

---

## 1. 한 줄 현황

Phase 1~5 (DB·BRIS 동기화·자동심사·발송큐·대시보드) 모두 구축 완료. 지금은 "운영 전 마지막 연결" 단계. 남은 것은 **(a) 자체 설문 페이지 실 URL**, **(b) 메일/SMS 실제 발송 경로**, **(c) Notion 운영판 연결(신규 요구)**, 그리고 **(d) Vercel 배포 공개**.

---

## 2. 저장소/배포 구성

| 항목 | 값 |
|------|----|
| Supabase 프로젝트 | `cs-survey` |
| Supabase ID | `gdwhbacuzhynvegkfoga` |
| Region | `ap-northeast-2` |
| Supabase URL | `https://gdwhbacuzhynvegkfoga.supabase.co` |
| Vercel 프로젝트 | (현재 폴더에 `vercel.json` 없음 — 실제 배포 중인 프로젝트 정보는 사용자 Vercel 계정에서 확인 필요) |
| Git 원격 | (마운트된 폴더에 `.git` 없음. Claude Code 측 로컬 클론에서 확인) |

> 위 값은 `.env` 에 있는 실 키를 기준으로 Claude Code에서 한 번 교차확인 필요 (SUPABASE_URL / SUPABASE_SERVICE_KEY / BRIS_API_KEY).

---

## 3. 폴더 구조 (운영 관련만)

```
target/
├─ cs_dashboard.html           # 운영 대시보드 (Supabase JS 클라이언트 연결, 10화면)
├─ cs대상자관리_통합.html       # 이전 통합 UI (히스토리 보존용)
├─ index.html                   # 진입 페이지
├─ bris_api.py                  # BRIS HTML 파서 (30필드)
├─ bris_to_supabase.py          # BRIS → Supabase 동기화 파이프라인
├─ bris_cron_runner.sh          # 매주 월 09:00 cron 진입점
├─ bris_examples.py             # BRIS API 사용 예제
├─ bris_proxy.asp / default.asp # ASP 측 보조
├─ Dockerfile / docker-compose.yml / Makefile    # BRIS API 컨테이너 배포
├─ lib/
│  ├─ bris-api/       (Python FastAPI — BRIS 래퍼 서버)
│  ├─ bris-parser/    (Node — HTML 파서)
│  └─ bris-parser-py/ (Python — HTML 파서)
├─ supabase/
│  └─ migrations/20260415_enhance_auto_batch.sql   # 최신 마이그레이션
├─ docs/
│  ├─ bris-api-guide/ (01~08 운영 가이드)
│  ├─ phase4-deployment.md
│  ├─ Supabase_vs_Notion_비교.md  (이번 세션 작성)
│  └─ HANDOFF_현재상태.md         (이 파일)
├─ backup/            (주 단위 CSV / JSON 백업)
└─ version/           (index_0.01 ~ 1.0 히스토리)
```

---

## 4. Supabase 구성 요약

**15개 테이블** — cs_companies, cs_business_places, cs_contacts, cs_projects, cs_courses, cs_project_members, cs_target_batches, cs_survey_targets, cs_dispatch_records, cs_survey_participation, cs_sync_logs, cs_trade_history, cs_survey_templates, cs_survey_questions, cs_survey_results

**5개 뷰** — v_cs_batch_dashboard, v_cs_target_detail, v_cs_target_candidates, v_cs_dispatch_summary, v_cs_system_health

**10개 RPC 함수** — fn_cs_create_batch_and_scan, fn_cs_step2_check_last_course, fn_cs_step3_check_project_closed, fn_cs_step4_check_survey_history, fn_cs_run_auto_screening, fn_cs_sync_start, fn_cs_sync_finish, fn_cs_post_sync_auto_batch, fn_cs_dispatch_batch, fn_cs_dispatch_event, fn_cs_generate_survey_token

**인증** — Supabase Auth. RLS: `allow_read` (anon+auth) + `allow_auth_write` (auth only). 이메일·SMS 큐도 RLS 활성.

---

## 5. 워크플로우 (현재 자동화 수준)

```
[매주 월 09:00]
  bris_cron_runner.sh
    └─ bris_to_supabase.py (mode=cron)
         ├─ fn_cs_sync_start  → cs_sync_logs
         ├─ BRIS 지난주 데이터 fetch
         ├─ upsert into cs_courses / cs_projects / cs_contacts ...
         ├─ fn_cs_sync_finish
         └─ fn_cs_post_sync_auto_batch
              ├─ fn_cs_create_batch_and_scan (Step1)
              └─ fn_cs_run_auto_screening    (Step2~4)
                   → cs_survey_targets (status = passed | excluded_stepN)

[담당자 수기]
  cs_dashboard.html 에서 Step5(최종확정) 토글
    → cs_survey_targets.status = confirmed

[발송 (현재 큐만, 실발송 미연결)]
  fn_cs_dispatch_batch
    → cs_dispatch_records 생성
    → email_queue / sms_queue 적재
    → (실제 발송 워커는 아직 없음)

[응답 (자체 설문 페이지 URL 미배포)]
  /survey/:token  → fn_cs_dispatch_event('responded')
    → cs_survey_participation 자동 적재
```

---

## 6. 지금 비어있는 것 (진짜 할 일)

| # | 항목 | 난이도 | 의존 |
|---|------|--------|------|
| 1 | Vercel에 cs_dashboard.html 배포 + 커스텀 도메인 | 낮음 | - |
| 2 | Supabase Auth 사용자 등록 (담당자 계정) | 낮음 | - |
| 3 | 자체 설문 페이지 라우트 `/survey/[token].html` | 중간 | Vercel 배포 |
| 4 | email_queue 워커: Supabase Edge Function + Resend | 중간 | Resend 계정 |
| 5 | sms_queue 워커: 알리고/Toast API 연결 | 중간 | SMS 계정 |
| 6 | **Notion DB 연동 (신규)** — passed/confirmed 건 단방향 푸시 | 중간 | Notion 토큰 |
| 7 | Notion → Supabase 역동기화 (기프티콘 체크 등) | 중간~높음 | 6번 |
| 8 | BRIS cron 실서버 등록 | 낮음 | 쿠키 파일 준비 |

---

## 7. Notion 연동 — 합의된 방향 (비교문서 5장 기준)

결정 대기 항목:
- 사내 보안상 Notion에 고객 개인정보(이메일·전화) 적재 가능 여부
- Notion → Supabase 역동기화 필요 여부 (단방향/양방향)
- `cs_dashboard.html` 폐기/병행 여부

잠정 설계 (양방향, 상태·사후관리만 Notion):

```
Notion DB "CS 대상자 관리" 속성
 ├─ 이름(제목) / 회사 / 과정 / 차수        [Supabase에서 주입, 읽기전용]
 ├─ 설문토큰 / 설문URL                     [Supabase에서 주입, 읽기전용]
 ├─ 발송상태  (Select: 대기/발송완료/실패)   [담당자가 변경]
 ├─ 응답여부  (Checkbox)                    [Supabase가 자동 체크]
 ├─ 응답일시  (Date)                        [Supabase가 자동 기록]
 ├─ 기프티콘  (Checkbox)                    [담당자 수기]
 ├─ 기프티콘 발송일 (Date)                  [담당자 수기]
 └─ 비고      (Rich text)                   [담당자 수기]

구현 부품
 1. Supabase Edge Function `notion_push`
     - trigger: cs_survey_targets.status → 'confirmed' 일 때
     - action: Notion API pages.create + 속성 세팅
     - 기록: cs_survey_targets.notion_page_id 컬럼 추가 필요
 2. Supabase Edge Function `notion_event_on_response`
     - trigger: cs_survey_participation INSERT
     - action: 해당 notion_page_id 의 '응답여부' 체크
 3. Notion Webhook → Supabase RPC `fn_cs_notion_state_sync`
     - '발송상태' / '기프티콘' 변경 시 Supabase에 역반영
     - 필요한 신규 컬럼: cs_survey_targets.gift_sent, gift_sent_at
```

---

## 8. Claude Code 이어받기 체크리스트

Claude Code에서 처음 열 때 실행 순서:

1. `.env` 복구 — Cowork 세션의 `.env` 값을 로컬에 복사 (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `BRIS_API_KEY`, 쿠키 파일 경로)
2. `supabase db pull` 또는 `supabase migration list` 로 현재 DB 스키마 버전 확인 — `20260415_enhance_auto_batch` 가 마지막이어야 함
3. Vercel CLI 연결: `vercel link` → 기존 프로젝트 선택
4. 로컬에서 `cs_dashboard.html` 열어보고 Supabase JS 키가 정상 로드되는지 확인
5. 위 6장 "비어있는 것" 중 어느 번호부터 진행할지 결정
6. Notion 작업(6번)을 택하면 비교문서 5장의 불편한 질문 3개 먼저 답하고 시작

---

## 9. 원본 참조 문서

- `docs/bris-api-guide/README.md` — BRIS API 사용 전반
- `docs/phase4-deployment.md` — Docker 배포
- `docs/Supabase_vs_Notion_비교.md` — 이번 세션 비교 결정용
- `개발계획서_CS대상자관리.md` — Phase 1~5 완료 보고
- `data_flow.md`, `data_model_v2.md` — 데이터 모델 원본
- `api_reference.md` — BRIS API 레퍼런스
