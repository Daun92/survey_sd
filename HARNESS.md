# CS 서비스 개발 하네스 — 영업기획팀 전환 버전

> **한 줄 정의**: "만족했습니까?"를 묻는 시스템이 아니라, "이 고객의 다음 거래는 언제인가?"를 예측하는 시스템을 만든다.

---

## 0. 시스템 전환의 핵심 차이

| 구분 | 마케팅실 CS (AS-IS) | 영업기획 CS (TO-BE) |
|------|-------------------|-------------------|
| **측정 단위** | 감정 (만족도 점수) | 행동 (재구매 여부) |
| **종착점** | 보고서 PDF | AM의 현장 행동 + 결과 추적 |
| **고객 식별** | 교육 참가자 (이름, 직위) | **place_id** (사업장 코드) — 수주·방문·수행요청 데이터와 연결 |
| **시간축** | 교육 직후 1회 | 교육 직후 + 1~2개월 후 발주자 접촉 |
| **질문 추가** | 없음 | 재계약 시그널 3문항 (내년 계획, 타주제 검토, 검토 시기) |
| **출력물** | 월간 만족도 보고서 | 주간 AM별 액션 리스트 (위험 고객 3건 + 이유 + 추천 행동) |

---

## 1. 프로세스 — 6단계 파이프라인

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 1.프로젝트│───→│ 2.대상자 │───→│ 3.설문   │───→│ 4.설문   │───→│ 5.응답   │───→│ 6.리포팅 │
│   관리   │    │   관리   │    │   설계   │    │   진행   │    │   관리   │    │ +시그널  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
  월간 설문      대상자 리스트    문항 템플릿      배포·수집       점수 산출       건강도 연동
  사이클 생성     + place_id     + 재계약 시그널   이메일/문자     카테고리별 집계   AM 액션 리스트
```

---

## 2. 각 단계별 서비스 명세

### 2-1. 프로젝트 관리 (Survey Lifecycle)

**목적**: 월간 CS 조사 사이클을 생성하고 진행 상태를 추적한다.

**데이터 모델**: `Survey` (기존 스키마 활용)

**상태 머신**:
```
draft → distributing → collecting → closed → reported
         ↑                                      │
         └──── (재발송 가능) ←─────── (리오픈)───┘
```

**화면**:
| 라우트 | 기능 |
|--------|------|
| `/admin/projects` | 월간 조사 목록 (연도/월/서비스유형 필터) |
| `/admin/projects/new` | 신규 조사 생성 — 서비스유형 선택 → 기본 템플릿 자동 적용 |
| `/admin/projects/[id]` | 조사 대시보드: 진행률, 응답률, 상태 전환 버튼 |

**핵심 로직**:
- 조사 생성 시 `QuestionTemplate.isDefault=true` 자동 로드
- 상태 전환은 명시적 버튼 (자동 전환 없음 — 운영자 통제)
- `surveyYear` + `surveyMonth` + `serviceTypeId`로 유니크 제약 (월 중복 생성 방지)

---

### 2-2. 대상자 관리 (Target Management)

**목적**: 이번 달 설문 대상 고객사를 확정하고, 각 고객의 place_id 연결을 보장한다.

**데이터 모델 확장 필요**:

```prisma
// Customer 모델에 추가
model Customer {
  // ... 기존 필드 유지
  placeId     String?  @map("place_id")  // ★ BRIS 사업장 코드 — 수주·방문 데이터 연결 키
  // ...
  @@index([placeId])  // 조인 성능용
}
```

> **이것이 전환의 핵심**: place_id가 있어야 설문 응답 ↔ 수주내역 ↔ 방문일지 ↔ 건강도 스코어가 연결된다.

**데이터 흐름**:
```
1. 수주팀이 교육실시여부 회신 (Excel)
2. Excel 임포트 → TrainingRecord 생성
3. hasTraining=true인 고객 → 이번 달 설문 대상
4. 대상 고객에 Distribution 레코드 자동 생성
5. place_id 누락 고객 → 경고 표시 (매칭 필요)
```

**화면**:
| 라우트 | 기능 |
|--------|------|
| `/admin/targets/[surveyId]` | 대상자 목록 — 교육실시여부 기반 자동 필터 |
| `/admin/targets/[surveyId]/import` | Excel 임포트 (교육실시여부 회신 파일) |
| `/admin/customers` | 고객사 마스터 관리 — place_id 매핑 상태 표시 |
| `/admin/customers/match` | place_id 미매칭 고객 일괄 매칭 도구 |

**핵심 로직**:
- 임포트 시 고객사명 + 서비스유형으로 기존 Customer 매칭 (fuzzy 허용)
- place_id 매칭률 대시보드: `전체 / 매칭 완료 / 미매칭` 표시
- 미매칭 고객은 설문 진행 가능하나, 리포팅 단계에서 건강도 연동 불가 경고

---

### 2-3. 설문 설계 (Survey Design)

**목적**: 서비스유형별 문항 템플릿을 관리하고, 영업기획 전환에 필요한 재계약 시그널 문항을 포함한다.

**문항 카테고리 구조 (6개)**:

| 카테고리 | 성격 | 문항 수 | 척도 | 대상 |
|---------|------|---------|------|------|
| A. 교육내용 | 만족도 (기존) | 3~4 | rating_5 | 교육 참가자 |
| B. 강사 | 만족도 (기존) | 3~4 | rating_5 | 교육 참가자 |
| C. 운영 | 만족도 (기존) | 3 | rating_5 | 교육 참가자 |
| D. 전반적만족도 | 만족도 (기존) | 4 | rating_5 | 교육 참가자 |
| E. 주관식/VOC | 정성 피드백 (기존) | 2 | text | 교육 참가자 |
| **F. 재계약 시그널** | **★ 신규 — 영업기획 전환의 핵심** | **3** | **single_choice** | **발주자/HR담당자** |

**카테고리 F: 재계약 시그널 문항 (신규)**:

```json
[
  {
    "questionOrder": 70,
    "questionText": "내년에도 유사한 교육을 계획하고 계십니까?",
    "questionType": "single_choice",
    "category": "재계약시그널",
    "isRequired": false,
    "options": ["예, 구체적으로 검토 중", "아마도", "아직 모르겠음", "계획 없음"]
  },
  {
    "questionOrder": 71,
    "questionText": "다른 주제의 교육도 검토 중이십니까?",
    "questionType": "single_choice",
    "category": "재계약시그널",
    "isRequired": false,
    "options": ["예, 구체적 주제가 있음", "관심은 있음", "아직 없음"]
  },
  {
    "questionOrder": 72,
    "questionText": "다음 교육 검토 시기는 대략 언제쯤입니까?",
    "questionType": "single_choice",
    "category": "재계약시그널",
    "isRequired": false,
    "options": ["1개월 이내", "3개월 이내", "6개월 이내", "내년 이후", "미정"]
  }
]
```

> **설계 원칙**: 재계약 시그널 문항은 `isRequired: false`. 응답 강제 시 왜곡 위험.
> 만족도 4.5점 + "계획 없음" = **이탈 위험 시그널** (점수만으로는 감지 불가).

**화면**:
| 라우트 | 기능 |
|--------|------|
| `/admin/templates` | 서비스유형별 템플릿 목록 |
| `/admin/templates/[id]` | 문항 편집 — 드래그 순서 변경, 카테고리 필터 |
| `/admin/templates/[id]/preview` | 응답자 화면 미리보기 |

---

### 2-4. 설문 진행 (Survey Execution)

**목적**: 설문을 배포하고 응답을 수집한다. 기존 이메일/문자 채널 유지.

**응답자 설문 폼**:
```
/surveys/[token]  ← Distribution.responseToken 기반 접근 (로그인 불필요)

┌──────────────────────────────────────────┐
│  [로고]  26년 3월 고객만족도 설문          │
│  교육유형: 집체  │  기업: 삼성전자(주)      │
├──────────────────────────────────────────┤
│  A. 교육내용                    [1/6]    │
│  ┌─────────────────────────────────────┐ │
│  │ Q1. 교육 일정 및 시간 배분은         │ │
│  │     적절하였습니까?                  │ │
│  │                                     │ │
│  │  ① ② ③ ④ ⑤  ○ 해당없음            │ │
│  └─────────────────────────────────────┘ │
│  ...                                     │
├──────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░  진행률 35%       │
│                              [다음 →]    │
└──────────────────────────────────────────┘
```

**배포 흐름**:
```
관리자가 "배포 시작" → Survey.status = "distributing"
  → Distribution 레코드별 responseToken 생성 (UUID)
  → 이메일 발송 (설문 링크 포함)
  → Distribution.status = "sent", sentAt = now()

응답자가 링크 클릭 → Distribution.status = "opened"
응답자가 제출 → Response + ResponseAnswer 생성
              → Distribution.status = "responded"

미응답 재발송 (문자) → Distribution.reminderCount++
```

**화면**:
| 라우트 | 기능 |
|--------|------|
| `/surveys/[token]` | 응답자용 설문 폼 (외부 공개, 토큰 인증) |
| `/surveys/[token]/complete` | 제출 완료 페이지 |
| `/admin/projects/[id]/distribute` | 배포 관리 — 발송/미응답 재발송/상태 모니터링 |

---

### 2-5. 응답 관리 (Response Management)

**목적**: 응답 데이터를 집계하고, 재계약 시그널과 만족도의 교차 분석을 제공한다.

**점수 산출 규칙**:
```
카테고리별 평균 = AVG(answerNumeric) WHERE category = X AND answerValue != 'X'
100점 환산     = 카테고리별 평균 × 20
전체 만족도    = AVG(A, B, C, D 카테고리 평균)
```

**★ 재계약 시그널 매트릭스 (영업기획 전환의 핵심 출력)**:

```
                    만족도 높음 (≥4.0)     만족도 낮음 (<4.0)
                  ┌─────────────────────┬─────────────────────┐
재계약 의향 있음   │  🟢 안전             │  🟡 불만 해소 필요     │
(구체적 검토 중)   │  유지 관리           │  개선 후 재계약 가능   │
                  ├─────────────────────┼─────────────────────┤
재계약 의향 없음   │  🟠 이탈 위험 ★      │  🔴 이탈 진행 중       │
(계획 없음/미정)   │  만족했는데 안 사는   │  당연히 안 사는 고객   │
                  │  이유 파악 필요       │  근본 문제 존재        │
                  └─────────────────────┴─────────────────────┘
```

> **🟠이 가장 중요한 셀**: 만족도만 보면 놓치는 고객. 이것이 마케팅 CS에서는 감지 불가능했던 이탈.

**화면**:
| 라우트 | 기능 |
|--------|------|
| `/admin/projects/[id]/responses` | 응답 목록 — 테이블 + 필터 (서비스유형, 지역, 시그널 등급) |
| `/admin/projects/[id]/analysis` | 카테고리별 점수 차트 + 시그널 매트릭스 |
| `/admin/projects/[id]/export` | Excel 다운로드 (ExcelJS) — 기존 양식 호환 |

**ResponseAnswer 저장 규칙**:

| questionType | answerNumeric | answerValue | 비고 |
|-------------|--------------|-------------|------|
| rating_5 | 1~5 또는 null | "1"~"5" 또는 "X" | X=해당없음, 집계 제외 |
| text | null | 자유 텍스트 | VOC 분석용 |
| single_choice | null | 선택한 옵션 텍스트 | 재계약 시그널용 |

---

### 2-6. 리포팅 + 시그널 연동 (Reporting & Signal Integration)

**목적**: 설문 결과를 기존 고객건강도 스코어 및 수주 데이터와 연결하여 AM 액션 리스트를 생성한다.

**이것이 마케팅 CS와 결정적으로 다른 단계.** 기존에는 보고서 PDF가 종착점이었다. 영업기획 CS에서는 AM이 이번 주 누구에게 전화할지가 종착점이다.

**데이터 모델 확장 필요**:

```prisma
// ★ 설문 결과 ↔ 건강도 연동 뷰
model CustomerSignal {
  id              Int       @id @default(autoincrement())
  customerId      Int       @map("customer_id")
  placeId         String?   @map("place_id")
  surveyId        Int?      @map("survey_id")

  // 만족도 지표
  satisfactionAvg Float?    @map("satisfaction_avg")   // 전체 만족도 평균 (1~5)

  // 재계약 시그널 (설문 카테고리 F 응답)
  recontractIntent   String?  @map("recontract_intent")   // "구체적 검토 중" ~ "계획 없음"
  otherTopicInterest String?  @map("other_topic_interest") // "있음" ~ "없음"
  nextReviewTiming   String?  @map("next_review_timing")   // "1개월 이내" ~ "미정"

  // 건강도 스코어 (외부 파이프라인에서 계산, 여기서 참조)
  healthScore     Int?      @map("health_score")        // 0~100
  healthGrade     String?   @map("health_grade")        // 위험/주의/관찰/양호

  // 복합 판정
  signalGrade     String?   @map("signal_grade")        // 안전/불만해소/이탈위험/이탈진행

  // AM 액션
  assignedAm      String?   @map("assigned_am")
  assignedTeam    String?   @map("assigned_team")
  recommendedAction String? @map("recommended_action")
  actionDeadline  DateTime? @map("action_deadline")
  actionTakenAt   DateTime? @map("action_taken_at")     // AM이 실제 행동한 시점
  actionResult    String?   @map("action_result")       // 결과 기록

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  customer Customer @relation(fields: [customerId], references: [id])
  survey   Survey?  @relation(fields: [surveyId], references: [id])

  @@unique([customerId, surveyId])
  @@map("customer_signals")
}
```

**시그널 등급 산출 로직**:

```typescript
function calculateSignalGrade(
  satisfactionAvg: number | null,
  recontractIntent: string | null
): string {
  const highSat = (satisfactionAvg ?? 0) >= 4.0;
  const hasIntent = ["예, 구체적으로 검토 중", "아마도"].includes(recontractIntent ?? "");

  if (highSat && hasIntent)   return "안전";        // 🟢
  if (!highSat && hasIntent)  return "불만해소필요";   // 🟡
  if (highSat && !hasIntent)  return "이탈위험";      // 🟠 ← 핵심 감지 대상
  return "이탈진행중";                               // 🔴
}
```

**AM 주간 액션 리스트 생성 규칙**:

```
1. 이번 달 설문 완료 고객 중 signalGrade = "이탈위험" 또는 "이탈진행중" 추출
2. place_id로 건강도 스코어(healthScore) 조인
3. AM별로 그룹핑 → 매출 상위 3건만 선택
4. 추천 액션 생성:
   - 이탈위험 (만족 높은데 의향 없음): "후속 니즈 파악 전화 — 만족했지만 재구매 의향 없는 이유 확인"
   - 이탈진행중 (만족 낮고 의향 없음): "불만 사항 해소 방문 — [VOC 주관식 내용] 관련 대면 논의"
   - 불만해소필요 (만족 낮은데 의향 있음): "개선 약속 후 제안 — 지적 사항 개선 계획 공유"
5. actionDeadline = 시그널 생성일 + 7일 (1주 내 접촉 권장)
```

**화면**:
| 라우트 | 기능 |
|--------|------|
| `/admin/reports/[yearMonth]` | 월간 종합 리포트 — 기존 보고서 대체 |
| `/admin/reports/[yearMonth]/signals` | 시그널 매트릭스 — 4분면 시각화 |
| `/admin/actions` | AM별 주간 액션 리스트 — 이번 주 할 일 |
| `/admin/actions/[amId]` | 특정 AM의 액션 상세 + 결과 입력 |
| `/admin/actions/track` | 액션 실행률 추적 — 접촉 vs 미접촉 재계약률 비교 |

---

## 3. 스키마 변경 요약

기존 스키마 12개 모델 중 변경/추가가 필요한 부분:

| 모델 | 변경 내용 |
|------|----------|
| `Customer` | `placeId` 필드 추가 (BRIS 사업장 코드) |
| `CustomerSignal` | **신규** — 설문 결과 + 건강도 + AM 액션 통합 |
| `Survey` ↔ `CustomerSignal` | 관계 추가 |
| `Customer` ↔ `CustomerSignal` | 관계 추가 |
| 나머지 10개 모델 | 변경 없음 |

---

## 4. 기존 인프라와의 연결 지점

### 4-1. 수주내역 (7,067건) ← place_id JOIN
```
Customer.placeId = 수주내역.place_id
→ 해당 고객의 수주 이력, 금액, 최근 수주일 조회
→ "마지막 수주 후 N일 경과" 계산
```

### 4-2. 방문일지 (54,840건) ← place_id JOIN
```
Customer.placeId = 방문일지.PLACE_ID
→ 해당 고객의 방문 빈도, 최근 방문일 조회
→ "하반기 방문 0회" 이탈 시그널과 교차 검증
```

### 4-3. 건강도 스코어 (729개사) ← place_id JOIN
```
CustomerSignal.placeId = 건강도_시그널리포트.place_id
→ 건강 등급(위험/주의/관찰/양호) + 4개 시그널 점수
→ 설문 시그널과 복합 판정
```

### 4-4. 데이터 임포트 전략
외부 데이터(수주/방문/건강도)는 **DB에 직접 저장하지 않는다** (BRIS가 원본).
대신:
- CSV 임포트 → 임시 테이블 또는 메모리 조인
- 리포팅 시점에 최신 CSV를 업로드하여 교차 분석
- ImportLog로 임포트 이력 추적

---

## 5. 구현 우선순위

### Phase 1: 기존 CS 디지털화 (Excel → 웹)
- [ ] 설문 생성/관리 (프로젝트 관리)
- [ ] 대상자 Excel 임포트 (교육실시여부)
- [ ] 응답자 설문 폼 (토큰 기반)
- [ ] 응답 집계 + Excel 다운로드
- [ ] 월간 보고서 뷰
> **산출물**: 기존 Excel 작업을 웹으로 옮긴 것. 기능적으로 동등.

### Phase 2: place_id 연결 + 재계약 시그널
- [ ] Customer에 placeId 추가 + 매칭 도구
- [ ] 문항 템플릿에 카테고리 F (재계약 시그널) 추가
- [ ] 시그널 매트릭스 (4분면) 시각화
- [ ] CustomerSignal 모델 + 시그널 등급 자동 산출
> **산출물**: "만족했는데 안 사는 고객" 감지 가능.

### Phase 3: AM 액션 시스템
- [ ] 수주/방문 CSV 임포트 + 교차 분석
- [ ] 건강도 스코어 연동
- [ ] AM별 주간 액션 리스트 자동 생성
- [ ] 액션 실행 추적 (접촉 vs 미접촉 재계약률)
> **산출물**: "이 3개사, 이번 주, 이 이유로" — AM이 움직이는 시스템.

---

## 6. 기술 스택 (확정)

| 레이어 | 기술 | 비고 |
|--------|------|------|
| Framework | Next.js 16.2.1 (App Router) | 서버 컴포넌트 기본 |
| DB | PostgreSQL (Supabase) | Prisma 7.5.0 ORM |
| UI | shadcn/ui + Tailwind CSS 4 | 다크 모드 기본 |
| 차트 | Recharts | 만족도 트렌드, 시그널 매트릭스 |
| Excel | ExcelJS | 임포트/다운로드 |
| 인증 | Supabase Auth (또는 토큰 기반) | 관리자/응답자 분리 |
| 배포 | Vercel | 자동 배포 |

---

## 7. 자문 체크리스트

매 단계 완료 시 자문:

- [ ] **AM이 이걸 보고 움직이겠는가?** — 30개사 전체 리스트 ❌ → 이번 주 3개사 + 이유 ✅
- [ ] **place_id가 연결되었는가?** — 연결 안 되면 "예쁜 설문 시스템"일 뿐, 매출 기여 증명 불가
- [ ] **기존 프로세스를 깨뜨리지 않는가?** — 설문 양식·배포 채널·응답 습관은 자산. 보존.
- [ ] **이탈 위험 고객이 보이는가?** — 만족도 높은데 재계약 의향 없는 🟠 셀이 가시화되는가
- [ ] **결과 귀속이 가능한가?** — "시그널 받고 접촉한 고객 vs 안 한 고객"의 재계약률 비교 구조

---

## 8. 현재 상태 체크포인트 (2026.03.23)

| 항목 | 상태 | 비고 |
|------|------|------|
| Prisma 스키마 12개 모델 | ✅ 정의 완료 | placeId, CustomerSignal 추가 필요 |
| 시드 데이터 (서비스유형 5종 + 템플릿 5종) | ✅ 작성 완료 | 카테고리 F 추가 필요 |
| DB 연결 (Supabase) | ⏳ 비밀번호 미설정 | .env에 [YOUR-PASSWORD] 상태 |
| 건강도 시그널 리포트 (모듈 1) | ✅ 분석 완료 | 729개사, 4등급 분류 |
| place_id 교차 검증 | ✅ 94.3% 매칭 | 수주 ∩ 방문 1,323개사 |
| CS 만족도 ↔ place_id 매칭 | ❌ 미완료 | Phase 2의 전제 조건 |
| 타이밍 설계 (모듈 2) | ❌ 미착수 | 재계약 주기 데이터 활용 가능 |
| 결과 귀속 (모듈 3) | ❌ 미착수 | Phase 3 이후 |
