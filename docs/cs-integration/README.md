# CS 대상자관리 ↔ 설문 배포 통합

로컬 `02. 대상자관리` v2 툴과 `survey_sd` 앱을 연결하는 통합 작업의 작업 기록·결정·설계 문서.

## 디렉토리 구조

```
docs/cs-integration/
├── README.md             ← 이 파일 (디렉토리 안내)
├── context.md            ← 불변 배경·구조·제약 (변할 때만 갱신)
├── decisions.md          ← 결정 로그 (append-only, ADR 스타일)
├── phase1-spec.md        ← Phase 1 상세 설계 (스키마·API·UI)
├── phase1-runbook.md     ← Phase 1 단계별 실행 순서·명령어
├── phase2-spec.md        ← Phase 2 상세 설계
├── phase2-kickoff-prompt.md ← Phase 2 새 세션 시작점 (복사용 프롬프트 + 읽기 순서)
└── worklog/
    ├── INDEX.md          ← 세션 인덱스 (최신 위)
    └── YYYY-MM-DD-*.md   ← 세션별 작업 기록
```

## 문서 운용 원칙

| 문서 | 성격 | 갱신 시점 |
|---|---|---|
| `context.md` | **불변** 맥락 | 전제·구조·제약이 바뀔 때만 |
| `decisions.md` | **append-only** | 새 결정이 생길 때마다 추가 (이전 항목 수정 금지) |
| `phase*-spec.md` | 살아있는 설계서 | 구현하면서 교정 |
| `worklog/*.md` | 세션 로그 | 세션마다 신규 파일 or 같은 날 이어쓰기 |

## 세션 시작 프로토콜

1. `context.md` 읽기 — 배경·제약 복기
2. `worklog/INDEX.md` 최근 2-3건 읽기 — 어디까지 왔는지
3. `decisions.md` 최근 항목 읽기 — 왜 그렇게 결정했는지
4. 해당 Phase spec 읽기 — 구체 설계
5. 새 worklog 파일 생성 (or 같은 날 이어쓰기) 시작

## 세션 종료 프로토콜

1. 오늘 세션 worklog 파일에 **Done / Decisions / Next** 요약
2. 새 결정이 있으면 `decisions.md`에 ADR 추가
3. spec 변경이 있으면 해당 phase spec 갱신
4. `worklog/INDEX.md` 상단에 오늘 세션 라인 추가
