# EXC-Survey PRD (Product Requirements Document)

**문서 작성일:** 2026년 3월 25일
**버전:** 0.1.0
**상태:** Active Development
**배포 URL:** https://exc-survey.vercel.app

---

## 1. 제품 개요

EXC-Survey는 엑스퍼트컨설팅 전용 **교육 만족도 설문 플랫폼**으로, 교육 CS 설문, 교육만족도 설문(S1~S7), HRD 실태조사 3가지 설문 유형을 관리한다. AI 기반 문항 자동생성, 응답 분석, 리포팅 기능을 포함한다.

### 핵심 지표
| 항목 | 수치 |
|------|------|
| 소스 파일 | 76개 |
| 코드 라인 | 10,744줄 |
| 페이지 | 23개 |
| API 라우트 | 7개 |
| UI 컴포넌트 | 10개 |
| DB 마이그레이션 | 8개 |

---

## 2. 기술 스택

| 계층 | 기술 |
|------|------|
| **프론트엔드** | Next.js 16.2.1, React 19.2.4, TypeScript 6.0 |
| **스타일링** | Tailwind CSS 4.2.2, Pretendard 폰트 |
| **백엔드** | Next.js API Routes + Server Actions |
| **데이터베이스** | Supabase PostgreSQL + RLS |
| **AI** | Google Gemini 3.1-flash-lite-preview |
| **차트** | Recharts 3.8.1 |
| **드래그&드롭** | @dnd-kit/core + sortable |
| **QR 코드** | qrcode.react 4.2.0 |
| **배포** | Vercel (Turbopack) |
| **인증** | Supabase Auth (이메일 기반) |

---

## 3. 데이터베이스 스키마 (22개 테이블)

### 교육/CS 설문 핵심 테이블
| 테이블 | 용도 |
|--------|------|
| `user_profiles` | 관리자/직원 (8개 역할: admin, manager, im, cs, am 등) |
| `organizations` | 고객사 |
| `projects` | 교육 프로젝트 |
| `courses` | 과정 (집합/원격/컨설팅/채용/공개) |
| `sessions` | 차수 |
| `class_groups` | 분반 (설문 배포 단위) |
| `edu_surveys` | 설문 인스턴스 (S1~S7, status: draft→active→closed) |
| `edu_questions` | 문항 (likert_5/7, 단일/복수선택, 주관식, 평점 등) |
| `edu_submissions` | 응답 데이터 |
| `cs_survey_templates` | CS 설문 템플릿 (6개 분과) |
| `cs_survey_questions` | CS 문항 (매핑 상태 추적) |

### HRD 실태조사 테이블
| 테이블 | 용도 |
|--------|------|
| `hrd_survey_rounds` | 조사 회차 |
| `hrd_survey_parts` | 6개 파트 (기본정보, P1~P5) |
| `hrd_survey_items` | 문항 (16+ 응답 유형) |
| `hrd_respondents` | 응답 기업 (조직유형, 산업분류) |
| `hrd_responses` | 개별 응답 |
| `hrd_benchmark_cache` | 벤치마크 통계 |
| `hrd_consulting_reports` | AI 컨설팅 리포트 |

### 시스템 테이블
| 테이블 | 용도 |
|--------|------|
| `app_settings` | 설정 (Gemini API 키 등) |
| `user_roles` | 역할 배정 |

---

## 4. 페이지 구조 (23개)

### 공개 페이지 (응답자용)
| 경로 | 용도 |
|------|------|
| `/s/[token]` | 교육 설문 응답 폼 (랜딩→질문→엔딩 3단계) |
| `/hrd/[token]` | HRD 실태조사 응답 폼 (멀티파트, 임시저장) |
| `/survey/[token]` | 범용 설문 응답 폼 |

### 관리자 페이지
| 경로 | 용도 |
|------|------|
| `/admin` | 대시보드 (KPI 4개, 최근 설문, 시스템 현황) |
| `/admin/quick-create` | 간편 생성 (고객사→프로젝트→설문 원스텝) |
| `/admin/projects` | 프로젝트 목록 + 생성 |
| `/admin/projects/[id]` | 프로젝트 상세 (과정/차수/설문 트리) |
| `/admin/surveys` | 설문 관리 (상태 필터, 검색, 프로젝트/고객사 컬럼) |
| `/admin/surveys/[id]` | 설문 편집기 (드래그 정렬, 인라인 편집, 미리보기, 설정 패널) |
| `/admin/cs-templates` | CS 문항 템플릿 라이브러리 |
| `/admin/cs-templates/[id]` | 템플릿 상세 |
| `/admin/responses` | 응답 관리 (집계 카드) |
| `/admin/responses/[surveyId]` | 응답 상세 (로우데이터 테이블, CSV 내보내기) |
| `/admin/reports` | 리포트 (AI 코멘트, 차트, CSV 내보내기) |
| `/admin/distribute` | QR 배포 (실제 QR 생성, 분반별 코드) |
| `/admin/settings` | 설정 (Gemini API 키 관리) |

### HRD 관리 페이지
| 경로 | 용도 |
|------|------|
| `/admin/hrd` | 실태조사 회차 관리 |
| `/admin/hrd/design` | 설문 설계 |
| `/admin/hrd/respondents` | 응답자(기업) 관리 |
| `/admin/hrd/dashboard` | 실시간 현황 |
| `/admin/hrd/statistics` | 전체 통계 |
| `/admin/hrd/consulting` | 컨설팅 보고서 |

---

## 5. API 라우트 (7개)

| 엔드포인트 | 메서드 | 용도 |
|-----------|--------|------|
| `/api/ai/generate-questions` | POST | AI 문항 자동생성 (파일 업로드 지원) |
| `/api/ai/analyze-responses` | POST | 개방형 응답 AI 분석 |
| `/api/ai/report-comment` | POST | 리포트 AI 코멘트 생성 |
| `/api/surveys/[id]/submit` | POST | 설문 응답 제출 |
| `/api/surveys/[id]/export` | GET | 설문 응답 CSV 내보내기 |
| `/api/hrd/responses/save` | POST | HRD 응답 저장/제출 |
| `/api/settings` | GET/POST | 앱 설정 관리 |

---

## 6. 구현 완료 기능

### 핵심 설문 관리 ✅
- 다중 설문 유형 지원 (S1~S7, CS, HRD)
- 7가지 문항 유형 (Likert 5/7점, 단일/복수선택, 주관식, 평점, 예/아니오)
- 드래그&드롭 문항 정렬
- 질문 인라인 편집 (클릭→텍스트 즉시 수정)
- 설문 설정 패널 (응답자 정보 수집, 익명, 진행률 표시)
- 랜딩/엔딩 페이지 문구 커스텀 (안내문, 감사 메시지)
- 2컬럼 에디터 (좌: 문항 편집 / 우: 모바일 미리보기)

### 워크플로우 연계 ✅
- 프로젝트 브레드크럼 (설문 편집기에서 프로젝트/고객사 컨텍스트)
- 워크플로우 CTA (편집→배포→응답→리포트 자연 흐름)
- 프로젝트 상세에서 설문 추가
- Quick-Create 간편 생성 (프로젝트 사전 선택 지원)

### AI 기능 ✅
- Gemini 3.1-flash-lite-preview 기반 문항 자동생성 (PDF/이미지 업로드)
- 개방형 응답 AI 분석 (키워드, 긍부정, 액션아이템)
- 리포트 AI 코멘트 (요약, 강점, 약점, 개선안)
- 설문 편집기 AI FAB (플로팅 버튼)

### 데이터 관리 ✅
- CSV 내보내기 (BOM 헤더로 Excel 한글 호환)
- 응답 상세 보기 (로우데이터 테이블)
- QR 코드 생성 및 배포 (분반별 코드 지원)
- 설문 목록 상태 필터 + 검색

### HRD 실태조사 ✅
- 멀티파트 설문 (6파트, 16+ 응답 유형)
- 임시저장 + 최종 제출
- 벤치마크 비교 (동종업종 통계)
- 컨설팅 리포트

### 디자인 시스템 ✅
- Paper MCP 기반 디자인 통일 (Pretendard 폰트, Teal/Stone 팔레트)
- 상태 배지 색상 체계 (진행중: emerald, 마감: rose, 초안: stone outline)
- UI 컴포넌트 라이브러리 (Badge, Button, Card, Input, Select, Textarea)

---

## 7. 부분 구현 / 진행 중

| 기능 | 상태 | 비고 |
|------|------|------|
| Supabase Auth 인증 | 파일 존재, 리다이렉트 비활성 | 로그인 페이지 미구현 |
| RLS 정책 | 마이그레이션 존재 | 전체 쿼리 테스트 필요 |
| 리포트 차트 | Recharts 컴포넌트 존재 | 일부 타입 이슈 수정됨 |
| CS 템플릿 상세 편집 | 조회 가능 | CRUD 완전하지 않음 |
| HRD 조건부 문항 | DB 지원 | UI 빌더 미구현 |

---

## 8. 미구현 (백로그)

### 높은 우선순위
- [ ] 로그인/인증 시스템 완성 (Supabase Auth)
- [ ] 설문 복제 기능
- [ ] 응답자 일괄 가져오기 (CSV)
- [ ] 이메일 알림/리마인더
- [ ] 권한 관리 UI (역할별 접근 제어)

### 중간 우선순위
- [ ] 고급 필터 (교차 분석, 복합 조건)
- [ ] 리포트 템플릿 저장
- [ ] Webhook API (응답 데이터 외부 전달)
- [ ] SSO 통합 (SAML/OAuth)
- [ ] 감사 로그

### 낮은 우선순위
- [ ] 다국어 지원 (i18n)
- [ ] 모바일 앱
- [ ] 실시간 협업 편집
- [ ] 화이트라벨 SaaS
- [ ] 결제 통합

---

## 9. 개발 이력

| 커밋 | 내용 |
|------|------|
| `807ba85` | 설문 에디터 UX + 랜딩/엔딩 커스텀 |
| `c7d1323` | middleware 인증 리다이렉트 수정 |
| `6c5019b` | Sprint 2: 설문 필터/검색 + 대시보드 액션 |
| `ce5fb39` | Sprint 1: 워크플로우 연계 (브레드크럼, 응답 상세) |
| `78c2d34` | Paper 디자인 시스템 테마 통일 |
| `9877813` | 설문 에디터 리팩토링 (드래그, 미리보기) |
| `3b75670` | Gemini 3.1-flash-lite-preview 모델 변경 |
| `6080786` | CSV 내보내기 |
| `de987c7` | Phase 3: AI 기능 (Gemini 연동) |
| `96ece8f` | Phase 1+2: 타입/UI/공개설문/QR 이식 |

---

## 10. 환경 설정

### 필수 환경 변수
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
NEXT_PUBLIC_APP_URL=<deployment-url>
```

### Gemini API 키
- `/admin/settings` 페이지에서 UI로 관리
- `app_settings` 테이블에 저장

### 빌드/실행
```bash
npm install
npm run dev          # 개발 (Turbopack)
npm run build        # 프로덕션 빌드
vercel --prod        # Vercel 배포
```

---

## 11. 파일 구조

```
exc-survey/
├── src/
│   ├── app/
│   │   ├── admin/          # 관리자 18페이지
│   │   │   └── hrd/        # HRD 6페이지
│   │   ├── api/            # 7개 API 라우트
│   │   ├── s/[token]/      # 교육 설문 공개 폼
│   │   ├── hrd/[token]/    # HRD 설문 공개 폼
│   │   └── survey/[token]/ # 범용 설문 폼
│   ├── components/
│   │   ├── ui/             # 6개 UI 프리미티브
│   │   ├── charts/         # 3개 차트 컴포넌트
│   │   └── Sidebar.tsx
│   ├── lib/
│   │   ├── supabase/       # client, server, admin, middleware
│   │   ├── validations/    # Zod 스키마
│   │   ├── gemini.ts       # AI 연동
│   │   └── utils.ts        # 유틸리티
│   └── types/              # 3개 타입 정의 파일
├── supabase/migrations/    # 8개 마이그레이션
└── docs/PRD.md             # 이 문서
```

---

**문서 버전:** 1.0
**최종 업데이트:** 2026년 3월 25일
