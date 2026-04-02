# 뿌리오(PPURIO) SMS 연동 가이드

## 개요

설문 링크 배포 및 응답 요청을 위한 뿌리오 문자 메시지 연동 시스템입니다.

- **API Base URL**: `https://message.ppurio.com`
- **API 문서**: https://www.ppurio.com/send-api/develop
- **인증 방식**: Basic Auth (토큰 발급) → Bearer Token (메시지 발송)

---

## 사전 준비

뿌리오 API 사용 전 아래 설정이 필요합니다.

1. [뿌리오](https://www.ppurio.com) 계정 생성
2. **문자 연동 > 문자 연동 관리** 메뉴에서:
   - 연동 IP 등록 (서버 IP / Vercel Edge IP)
   - Auth Key(개발 인증키) 발급
3. 발신번호 사전 등록

---

## 환경변수 설정

Vercel Dashboard > Settings > Environment Variables에 등록합니다.

```env
PPURIO_USERNAME=blue5903              # 뿌리오 계정 ID
PPURIO_TOKEN=64aa304976eb11a3...      # 개발 인증키 (Auth Key)
PPURIO_SENDER_PHONE=01012345678       # 기본 발신번호 (숫자만)
```

> **주의**: `.env` 파일에 직접 넣지 마세요. 시크릿 키는 반드시 Vercel 환경변수로 관리합니다.

또는 관리자 UI(**배포 > SMS 제공자 설정**)에서 DB 기반으로 등록할 수도 있습니다.

---

## 인증 토큰 구조

토큰이 **2개** 있으므로 혼동에 주의합니다.

| 구분 | 용도 | 유효기간 | 관리 방식 |
|------|------|----------|-----------|
| **Auth Key** (고정) | 액세스 토큰 발급용 인증키 | 영구 (뿌리오 발급) | 환경변수 `PPURIO_TOKEN` |
| **Access Token** (동적) | 메시지 발송용 Bearer 토큰 | 1일 (자동 갱신) | 코드 내부 자동 관리 |

### 토큰 발급 흐름

```
PPURIO_USERNAME + PPURIO_TOKEN (Auth Key)
    ↓ Basic Auth (Base64 인코딩)
POST /v1/token
    ↓ 응답: { token, type: "Bearer", expired: "yyyyMMddHHmmss" }
Access Token 캐시 (만료 5분 전 자동 갱신)
    ↓ Bearer Token
POST /v1/message → 문자 발송
```

---

## API 엔드포인트 요약

| 기능 | Method | Endpoint | 인증 | 설명 |
|------|--------|----------|------|------|
| 토큰 발급 | POST | `/v1/token` | Basic Auth | 액세스 토큰 발급 (1일 유효) |
| 메시지 발송 | POST | `/v1/message` | Bearer Token | SMS/LMS/MMS 발송 |
| 예약 취소 | POST | `/v1/cancel` | Bearer Token | 예약 발송 취소 (1분 전까지) |

---

## 메시지 발송 파라미터

### 필수 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `account` | text(20) | 뿌리오 계정 |
| `messageType` | text(3) | `SMS` / `LMS` / `MMS` |
| `content` | text(2000) | 메시지 내용 (SMS: 90byte, LMS/MMS: 2000byte) |
| `from` | text(16) | 발신번호 |
| `duplicateFlag` | text(1) | 수신번호 중복 허용 (`Y`/`N`) |
| `targetCount` | number | 수신자 수 |
| `targets` | array | 수신자 목록 |
| `refKey` | text(32) | 고객사 부여 키 (UUID 사용) |

### 선택 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `rejectType` | text(2) | 광고 수신거부 설정 (`AD`) |
| `sendTime` | text(19) | 예약 발송 `yyyy-MM-ddTHH:mm:ss` (최소 3분 후) |
| `subject` | text(30) | 제목 (LMS/MMS) |
| `files` | array | MMS 첨부 파일 (jpg/jpeg, 최대 300KB, Base64) |

### 수신자 (targets)

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `to` | text(16) | 수신번호 (필수) |
| `name` | text(100) | `[*이름*]` 치환 문구 |
| `changeWord` | json | `var1`~`var8` → `[*1*]`~`[*8*]` 치환 |

---

## 응답 코드

### 성공

```json
{
  "code": 1000,
  "description": "ok",
  "refKey": "unique-ref-key-001",
  "messageKey": "221128133505801SMS010542suchUL8P"
}
```

### 주요 에러 코드

| Code | 설명 |
|------|------|
| 2000 | 잘못된 요청 |
| 3001 | Authorization 헤더 유효하지 않음 |
| 3002 | 토큰 유효하지 않음 |
| 3003 | IP 유효하지 않음 |
| 3004 | 계정 유효하지 않음 |
| 3008 | 너무 많은 요청 (Rate Limit) |
| 4004 | API 접근 권한 비활성화 |
| 4006 | 인증키 유효하지 않음 |
| 4007 | 인증키 미발급 |

---

## 프로젝트 내 구현 구조

### 핵심 파일

```
src/lib/sms/
├── types.ts                  # SmsSendRequest, SmsResult, SmsSender 인터페이스
├── sender.ts                 # PpurioSmsSender 클래스 (+ Aligo, Mock)
└── template-renderer.ts      # SMS 템플릿 변수 치환, 바이트 계산

src/app/api/
├── distributions/send-sms/route.ts   # SMS 배포 발송 API
└── cron/send-sms/route.ts            # 예약 SMS 큐 처리 (CRON)

src/app/admin/distribute/
├── sms-send-panel.tsx        # SMS 발송 UI (템플릿 선택, 미리보기, 발송)
├── sms-provider-settings.tsx # SMS 프로바이더 관리 UI
└── actions.ts                # scheduleSmsBatch, sendTestSms 등 서버 액션
```

### 발송 흐름

```
[관리자 UI]                     [백엔드]                    [뿌리오 API]
                               
배포 페이지                                                
  ├─ SMS 템플릿 선택                                       
  ├─ 미리보기/편집                                         
  ├─ 테스트 발송 ──────→ sendTestSms() ──────→ POST /v1/message
  └─ 일괄 발송 ───────→ scheduleSmsBatch()                
                          ├─ sms_queue INSERT              
                          └─ (즉시) sender.send() ──→ POST /v1/message
                                                          
CRON (예약발송)                                            
  /api/cron/send-sms ──→ sms_queue 조회 ──→ sender.send() ──→ POST /v1/message
```

### SMS/LMS 자동 판별

EUC-KR 기준 바이트 길이로 자동 판별합니다.

- **SMS**: 90바이트 이하 (한글 약 45자)
- **LMS**: 90바이트 초과 ~ 2000바이트 (한글 약 1000자)

### 발신번호 우선순위

동적 발신번호를 지원합니다.

1. API 요청의 `from` 파라미터 (최우선)
2. 프로바이더 설정의 `sender_phone` (기본값)

### 프로바이더 우선순위 (환경변수 팩토리)

1. 뿌리오: `PPURIO_USERNAME` + `PPURIO_TOKEN` + `PPURIO_SENDER_PHONE`
2. 알리고: `ALIGO_API_KEY` + `ALIGO_USER_ID` + `ALIGO_SENDER_PHONE`
3. Mock (위 둘 다 미설정 시)

> DB 기반 프로바이더(`sms_providers` 테이블)가 등록되어 있으면 환경변수보다 우선합니다.

---

## 활용 시나리오

### 1. 설문 링크 SMS 배포

관리자가 배포 페이지에서 수신자 목록 업로드 후 SMS 탭에서 발송합니다.

- 즉시 발송 / 예약 발송 / 트리거 발송(교육 종료 N일 후) 지원
- 템플릿 변수: `{회사명}`, `{담당자명}`, `{과정명}`, `{설문링크}`, `{교육종료일}`

### 2. 미응답자 재발송

배포 상태 페이지에서 미응답자에게 개별 또는 일괄 SMS 재발송이 가능합니다.

### 3. 테스트 발송

실제 대량 발송 전 테스트 번호로 미리 확인할 수 있습니다.

---

## 주의사항

1. **연동 IP 등록 필수** — 뿌리오 관리 페이지에서 서버 IP를 등록하지 않으면 `3003` 에러 발생
2. **발신번호 사전 등록** — 미등록 번호로는 발송 불가
3. **SMS 바이트 제한** — 90바이트 초과 시 자동으로 LMS로 전환 (요금 차이 있음)
4. **예약 발송 제약** — 최소 3분 이후, 최대 다음 해 말일까지
5. **예약 취소 제약** — 발송 1분 전까지만 취소 가능
6. **Rate Limit** — 과도한 요청 시 `3008` 에러 발생 (큐 기반 발송으로 대응)
7. **Vercel Edge IP** — Vercel 배포 시 IP가 동적이므로 뿌리오 IP 허용 범위 확인 필요
