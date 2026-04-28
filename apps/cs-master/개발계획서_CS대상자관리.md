# CS 대상자 관리 시스템 — 개발 계획서

## 현재 상태 (2026-04-13 업데이트)

Phase 1~5 전체 완료. 운영 준비 상태.

### 완료 항목

- Supabase DB 스키마 (15개 테이블 + 5개 뷰 + 2개 트리거 + 10개 함수)
- BRIS HTML 파서 (bris_api.py) — 30개 필드 정확 파싱
- BRIS → Supabase 연동 파이프라인 (bris_to_supabase.py) — sync log 연동 완료
- 대시보드 UI (cs_dashboard.html) — 10개 화면, 실데이터 연결
- 5단계 선정 워크플로우 SQL 함수 (자동 심사 2~4단계)
- 설문 발송 파이프라인 (email/sms 큐 연동, 이벤트 추적)
- RLS 보안 정책 (인증 기반 읽기/쓰기 분리)
- 모니터링 뷰 (v_cs_system_health)
- cron 자동 실행 스크립트 (bris_cron_runner.sh)

### 운영 전 필요 작업

- Supabase Auth 사용자 등록 (이메일/비밀번호)
- Vercel 배포 (또는 정적 호스팅)
- BRIS 쿠키 파일 준비 및 cron 등록
- 설문 URL 엔드포인트 실제 주소 설정
- 이메일 발송 서비스 연결 (SendGrid/Resend 등)

---

## 기술 스택

| 레이어 | 선택 | 이유 |
|--------|------|------|
| DB | Supabase (PostgreSQL) | 구축 완료, RLS/실시간 지원 |
| 백엔드 | Supabase RPC + Edge Functions | 별도 서버 불필요 |
| 프론트엔드 | HTML + Supabase JS Client | 프로토타입 기반, 즉시 작동 |
| BRIS 연동 | Python (bris_api.py + bris_to_supabase.py) | 구현 완료, cron 실행 |
| 인증 | Supabase Auth | 기본 제공 |

---

## 개발 단계 — 완료 보고

### Phase 1 — 데이터 연결 ✅

- cs_dashboard.html에 supabase-js CDN 연결
- 하드코딩 데이터 → 실DB 쿼리 전환
- KPI, 테이블, 필터 모두 실데이터 작동
- 파일: cs_dashboard.html

### Phase 2 — 워크플로우 엔진 ✅

- fn_cs_create_batch_and_scan: 배치 생성 + Step 1 자동 스캔
- fn_cs_step2_check_last_course: 최종 과정 확인
- fn_cs_step3_check_project_closed: 프로젝트 마감 확인
- fn_cs_step4_check_survey_history: 6개월 이내 설문 이력 확인
- fn_cs_run_auto_screening: 2~4단계 일괄 실행
- 트리거: is_last_in_project 자동 갱신, survey_stats 자동 갱신
- 테스트 결과: 6후보 → 3통과(Step2) → 2통과(Step3) → 2통과(Step4) → 2확정(Step5)

### Phase 3 — BRIS 자동 동기화 ✅

DB 구현:
- cs_sync_logs 테이블 (이력 관리)
- fn_cs_sync_start / fn_cs_sync_finish (로그 관리)
- fn_cs_post_sync_auto_batch (동기화 후 자동 배치 생성 + 심사)

Python 구현:
- bris_to_supabase.py 업데이트 — sync log RPC 호출 통합
- 모드: html, fetch, cron (지난주 자동 동기화)
- bris_cron_runner.sh — .env 로드, 필수 변수 검증
- .env.example — 환경변수 템플릿

cron 등록 예시:
```
0 9 * * 1 /path/to/bris_cron_runner.sh >> /var/log/bris_sync.log 2>&1
```

### Phase 4 — 발송 연동 ✅

템플릿:
- email_templates: cs_survey_default (HTML 이메일, 7개 변수 치환)
- sms_templates: cs_survey_default (LMS, 4개 변수 치환)

함수:
- fn_cs_generate_survey_token: 추적용 고유 토큰 생성
- fn_cs_dispatch_batch: 배치 일괄 발송 (auto/email/sms 채널)
  - cs_dispatch_records 생성 → email_queue 또는 sms_queue 등록
  - cs_survey_targets 상태 dispatched로 갱신
- fn_cs_dispatch_event: sent/opened/responded/failed 이벤트 처리
  - responded 시 cs_survey_participation 자동 적재

뷰:
- v_cs_dispatch_summary: 배치별 발송/응답/실패 통계

테스트 결과: 2명 발송 → 1명 응답(김정수 4.5점) → participation 자동 기록

### Phase 5 — 배포 및 운영 ✅

보안:
- RLS 정책 교체: temp_anon → allow_read (anon+auth) + allow_auth_write (auth only)
- email/sms 큐 테이블에도 RLS 활성화
- cs_dispatch_records, cs_survey_targets 상태 제약 확장

모니터링:
- v_cs_system_health: 실행중 동기화, 7일 에러, 큐 대기, 진행중 배치, 실패 발송

대시보드:
- 동기화 페이지: cs_sync_logs 실데이터, 시스템 상태 표시
- 발송 현황: v_cs_dispatch_summary 실데이터
- CSV 내보내기 기능 구현
- 거래이력 패널: 실DB 조회

---

## DB 구조 요약

### 테이블 (15개)

| 테이블 | 용도 |
|--------|------|
| cs_companies | 회사 |
| cs_business_places | 사업장 |
| cs_contacts | 고객 담당자 (DM) |
| cs_projects | 프로젝트 (수주 단위) |
| cs_courses | 교육과정 |
| cs_project_members | 프로젝트 멤버 (AM, 컨설턴트, 강사) |
| cs_target_batches | 선정 배치 |
| cs_survey_targets | 설문 대상자 (5단계 심사) |
| cs_dispatch_records | 발송 기록 |
| cs_survey_participation | 설문 참여 이력 |
| cs_sync_logs | BRIS 동기화 이력 |
| cs_trade_history | 거래 이력 |
| cs_survey_templates | 설문 양식 |
| cs_survey_questions | 설문 문항 |
| cs_survey_results | 설문 응답 결과 |

### 뷰 (5개)

- v_cs_batch_dashboard: 배치별 대시보드 KPI
- v_cs_target_detail: 대상자 상세 (조인)
- v_cs_target_candidates: 후보자 목록
- v_cs_dispatch_summary: 발송 현황 통계
- v_cs_system_health: 시스템 상태 모니터링

### 함수 (10개)

- fn_cs_create_batch_and_scan: 배치 생성 + Step 1
- fn_cs_step2_check_last_course: Step 2 최종과정 확인
- fn_cs_step3_check_project_closed: Step 3 마감 확인
- fn_cs_step4_check_survey_history: Step 4 이력 확인
- fn_cs_run_auto_screening: Step 2~4 일괄 실행
- fn_cs_sync_start / fn_cs_sync_finish: 동기화 로그
- fn_cs_post_sync_auto_batch: 동기화 후 자동 배치
- fn_cs_dispatch_batch: 일괄 발송
- fn_cs_dispatch_event: 발송 이벤트 처리
- fn_cs_generate_survey_token: 토큰 생성

---

## 파일 목록

| 파일 | 설명 |
|------|------|
| cs_dashboard.html | 대시보드 UI (10화면, 실데이터) |
| bris_api.py | BRIS HTML 파서 + 클라이언트 |
| bris_to_supabase.py | BRIS → Supabase 동기화 파이프라인 |
| bris_examples.py | BRIS API 사용 예제 8가지 |
| bris_cron_runner.sh | cron 자동 실행 스크립트 |
| .env.example | 환경변수 템플릿 |

---

## Supabase 프로젝트 정보

- 프로젝트: cs-survey
- ID: gdwhbacuzhynvegkfoga
- Region: ap-northeast-2
- URL: https://gdwhbacuzhynvegkfoga.supabase.co
