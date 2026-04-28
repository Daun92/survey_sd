# brisAPi - API Reference

Base URL: `https://bris.exc.co.kr/api`

---

## 1. 생산성지표 (팀별)

팀별 생산성 KPI 지표를 집계하여 반환한다. 거래고객, 고객유지, 에코가동률, 방문횟수, 전략영업, 크로스셀링 등의 원시 데이터를 제공한다.

**Endpoint:** `GET /productivity/list_productivity_team`

### 파라미터

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| yy | int | X | 올해 | 조회 연도 |

### 응답 예시

```json
{
  "yy": 2026,
  "count": 12,
  "data": [
    {
      "teamCode": 201201001,
      "teamName": "서울1팀",
      "groupcode": 201201,
      "member_count": 4,
      "cus_cur_sum": 38,
      "cus_prev_sum": 42,
      "echo_active_sum": 15,
      "echo_target_sum": 20,
      "visit_point_sum": 245.5,
      "visit_workday_sum": 58.0,
      "strategy_big_sum": 3,
      "strategy_big_target_sum": 12,
      "strategy_nego_sum": 1,
      "strategy_nego_target_sum": 3,
      "cross_team_score": 18.5,
      "cross_contrib_sum": 7,
      "updated_at": "2026-03-24T10:30:00",
      "keep_prev": 42,
      "keep_cur": 35
    }
  ]
}
```

### 필드 설명

| 필드 | 의미 | 활용 (대시보드 계산) |
|------|------|---------------------|
| cus_cur_sum | 금년 거래고객 수 | 거래고객 달성률 = cus_cur / cus_prev × 100 |
| cus_prev_sum | 전년 거래고객 수 | (기준값) |
| keep_cur | 금년 유지고객 수 | 고객유지율 = keep_cur / keep_prev × 100 |
| keep_prev | 전년 고객 수 | (기준값) |
| echo_active_sum | 에코 가동 수 | 에코가동률 = echo_active / echo_target × 100 |
| echo_target_sum | 에코 목표 수 | (기준값) |
| visit_point_sum | 방문 포인트 합계 | 일평균 방문 = visit_point / visit_workday |
| visit_workday_sum | 근무일수 합계 | (기준값) |
| strategy_big_sum | 대형계약 실적 | 전략영업 달성률 = strategy_big / strategy_big_target × 100 |
| strategy_big_target_sum | 대형계약 목표 | (기준값) |
| cross_contrib_sum | 크로스셀링 기여건수 | 그대로 표시 |

---

## 2. 영업활동 (개인별)

당월 영업활동 지표를 개인별로 반환한다. DM등록, 방문, 제안요청, 수주 건수를 포함한다. 전체 팀 데이터를 한 번에 반환하므로 클라이언트에서 teamName으로 필터링하여 사용한다.

**Endpoint:** `GET /productivity/list_salesact`

### 파라미터

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| yy | int | X | 올해 | 조회 연도 |
| mm | int | X | 이번 달 | 조회 월 |

### 응답 예시

```json
{
  "yy": 2026,
  "mm": 3,
  "count": 25,
  "data": [
    {
      "i_no": 5921,
      "i_name": "이제혁",
      "position3": "과장",
      "teamCode": 201300001,
      "teamName": "경기팀",
      "dm_cnt": 2,
      "visit_cnt": 24,
      "req_cnt": 10,
      "suju_cnt": 8
    },
    {
      "i_no": 4447,
      "i_name": "정용호",
      "position3": "실장",
      "teamCode": 201300001,
      "teamName": "경기팀",
      "dm_cnt": 4,
      "visit_cnt": 21,
      "req_cnt": 4,
      "suju_cnt": 9
    }
  ]
}
```

### 필드 설명

| 필드 | 의미 |
|------|------|
| i_no | 사번 |
| i_name | 이름 |
| position3 | 직급 |
| teamCode | 팀 코드 |
| teamName | 팀명 (필터링 키) |
| dm_cnt | 당월 DM 등록 건수 |
| visit_cnt | 당월 방문 건수 |
| req_cnt | 당월 제안요청 건수 |
| suju_cnt | 당월 수주 건수 |

---

## 3. To-Do (팀별)

팀별 미처리 업무 현황을 반환한다. 미방문 문의, 방문결과 미등록, 제안결과 미등록, 제안마감 예정, 교육 후 미방문 등의 카운트를 포함한다. 장기 미처리건도 별도로 집계한다.

**Endpoint:** `GET /productivity/team_todo`

### 파라미터

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| teamcode | str | O | - | 팀 코드 |
| yy | int | X | 올해 | 조회 연도 |

### 응답 예시

```json
{
  "teamcode": "201201001",
  "totalNoVisit": 87,
  "longNoVisit": 81,
  "totalVisitPending": 10,
  "longVisitPending": 0,
  "totalReqPending": 25,
  "longReqPending": 9,
  "proposalScheduled": 1,
  "proposalThisWeek": 1,
  "proposalNextWeek": 0,
  "eduNoVisit": 0
}
```

### 필드 설명

| 필드 | 의미 | 장기 기준 |
|------|------|----------|
| totalNoVisit | 1:1 문의 후 미방문 건수 | - |
| longNoVisit | 그 중 장기 미방문 | 14일 초과 |
| totalVisitPending | 방문 후 결과 미등록 건수 | - |
| longVisitPending | 그 중 장기 미등록 | 7일 초과 |
| totalReqPending | 제안 결과 미등록 건수 | - |
| longReqPending | 그 중 장기 미등록 | 14일 초과 |
| proposalScheduled | 마감 예정 제안 건수 | - |
| proposalThisWeek | 이번 주 마감 예정 | - |
| proposalNextWeek | 다음 주 마감 예정 | - |
| eduNoVisit | 교육 후 미방문 건수 | - |

---

## 4. 수주실적 (팀별)

팀별 수주실적을 통합하여 반환한다. 총 수주금액/건수, 대형계약, 1000대기업, 신규고객, 전월대비 영업활동 변화량, 개인별 실적을 포함한다.

**Endpoint:** `GET /productivity/team_performance`

### 파라미터

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| teamcode | str | O | - | 팀 코드 |
| yy | int | X | 올해 | 조회 연도 |

### 응답 예시

```json
{
  "teamcode": "201201001",
  "yy": 2026,
  "amt": 848.4,
  "cnt": 53,
  "avgAmt": 16.0,
  "bigCnt": 2,
  "bigAmt": 250.7,
  "bigAmtRatio": 29.5,
  "top1000": 18,
  "newCust": 5,
  "dm_chg": -10,
  "visit_chg": 5,
  "req_chg": 7,
  "suju_chg": 0,
  "persons": [
    {
      "i_name": "홍길동",
      "position3": "실장",
      "perf_total_price": 324248700,
      "perf_big_count": 1,
      "perf_avg_price": 16212435,
      "perf_top1000_count": 8,
      "perf_new_count": 3
    }
  ]
}
```

### 필드 설명

| 필드 | 의미 | 단위 |
|------|------|------|
| amt | 총 수주금액 | 백만원 |
| cnt | 총 수주건수 | 건 |
| avgAmt | 건당 평균 수주금액 | 백만원 |
| bigCnt | 대형계약 건수 (5천만 이상) | 건 |
| bigAmt | 대형계약 금액 | 백만원 |
| bigAmtRatio | 대형계약 비율 | % |
| top1000 | 1000대기업 수주 고객수 | 건 |
| newCust | 신규고객 수 (3년 내 거래 없던 고객) | 건 |
| dm_chg | DM 등록 전월대비 변화 | 건 (이번달 - 직전3개월평균) |
| visit_chg | 방문 전월대비 변화 | 건 |
| req_chg | 제안요청 전월대비 변화 | 건 |
| suju_chg | 수주 전월대비 변화 | 건 |
| persons | 개인별 실적 리스트 | - |

### persons 필드 상세

| 필드 | 의미 |
|------|------|
| i_name | 이름 |
| position3 | 직급 |
| perf_total_price | 총 수주금액 (원) |
| perf_big_count | 대형계약 건수 |
| perf_avg_price | 평균 수주금액 (원) |
| perf_top1000_count | 1000대기업 수주 건수 |
| perf_new_count | 신규고객 수주 건수 |

---

## 팀 코드 참조

| 팀명 | 팀코드 | 본부 |
|------|--------|------|
| 서울1팀 | 201201001 | 서울본부 |
| 서울2팀 | 201201002 | 서울본부 |
| 서울3팀 | 201202001 | 서울본부 |
| 서울4팀 | 2501 | 서울본부 |
| 경기팀 | 201300001 | 경기본부 |
| 경인팀 | 2003 | 경기본부 |
| 중부팀 | 201204002 | 지방본부 |
| 호남팀 | 201204004 | 지방본부 |
| 부산울산경남팀 | 201204001 | 지방본부 |
| 대구경북팀 | 201204003 | 지방본부 |
| 공공사업1팀 | 2506 | 지방본부 |
| 공공사업2팀 | 2511 | 지방본부 |

---

## 공통 사항

- 모든 API는 JSON 형식으로 응답
- 에러 발생 시 `{"error": "메시지"}` 형태의 500 응답 반환
- CORS 허용: `apps.qpeed.co.kr`, `apps.exc.co.kr`
- Swagger UI: `https://bris.exc.co.kr/api/docs`
