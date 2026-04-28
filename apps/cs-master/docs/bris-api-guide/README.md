# BRIS API Server 활용 가이드

**버전**: 0.1.0
**대상 독자**: 운영자 (일상 운용, 배포, 장애 대응)
**API Base URL**: `http://localhost:8000` (기본 / 포트는 `.env` `HOST_PORT` 로 조정)

---

## 이 가이드는?

Phase 3~4 로 패키징된 `bris-api-server` 컨테이너를 **배포·운영하는 사람**을 위한 실전 매뉴얼입니다. 파서 로직 자체의 구현이 아니라 **"호출하면 어떻게 되는가"**, **"실패 시 무엇을 봐야 하는가"** 에 초점을 둡니다.

## 목차

| # | 문서 | 언제 보나 |
|---|------|-----------|
| [01](./01-quickstart.md) | 퀵스타트 | 처음 기동해서 첫 호출 성공시킬 때 |
| [02](./02-authentication.md) | 인증 (X-API-Key) | 키 교체, 401/500 응답 해석 |
| [03](./03-endpoints-parse.md) | Parse 엔드포인트 8종 | BRIS HTML 한 페이지를 JSON 으로 변환할 때 |
| [04](./04-endpoints-sync.md) | Sync 엔드포인트 2종 | BRIS→Supabase 자동 동기화 |
| [05](./05-error-codes.md) | HTTP 에러 코드 | 응답 코드 해석 + 복구 절차 |
| [06](./06-client-examples.md) | 클라이언트 샘플 | curl / Python / JS 코드 스니펫 |
| [07](./07-operations.md) | 운영 작업 | 로그, 재시작, 재빌드, 백업 |
| [08](./08-troubleshooting.md) | 문제 해결 (FAQ) | 자주 마주치는 증상 → 해결 |

## 이 가이드 밖의 문서

| 문서 | 위치 | 내용 |
|------|------|------|
| Docker 배포 매뉴얼 | [`../phase4-deployment.md`](../phase4-deployment.md) | Dockerfile·compose 구성, 기동·중지 |
| Supabase 마이그레이션 적용 가이드 | [`../../supabase/migrations/README.md`](../../supabase/migrations/README.md) | echo_exclude_reason 강화 SQL 적용·검증·롤백 절차 |
| 상류 brisAPi 참조 | [`../../api_reference.md`](../../api_reference.md) | **상류** BRIS 시스템 API (이 서버 아님) |
| bris-api-server 패키지 내부 | [`../../lib/bris-api/README.md`](../../lib/bris-api/README.md) | 개발자용 개요 |

## 용어

| 용어 | 뜻 |
|------|-----|
| **BRIS** | 사내 교육관리 시스템 (bris.exc.co.kr) — 데이터 원천 |
| **파서** | BRIS HTML 을 JSON 으로 변환하는 순수 함수 (8종) |
| **Sync** | BRIS fetch + Supabase upsert 를 한 번에 수행 |
| **X-API-Key** | 이 서버가 인증에 쓰는 HTTP 헤더 이름 |
| **통합 페이지** | BRIS `/default.asp?bris_proxy=...` 로 받은 월별 통합 HTML |
| **autoBatch** | sync 이후 CS 배치 후보를 자동 생성할지 여부 |

## 읽는 순서 (추천)

- **첫 배포 / 인수인계** → 01 → 02 → 07 → 08
- **API 콜 통합 (외부 팀 지원)** → 01 → 02 → 03 → 06 → 05
- **장애 대응 당직** → 08 → 05 → 07
