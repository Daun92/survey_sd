# Component RFC — <컴포넌트 이름>

> 이 템플릿은 [`03-components.md`](../03-components.md) 의 pattern 규약을 따릅니다. 신규 pattern·composite 제안 시 복사해 사용하세요.

- **제안자**: <이름>
- **상태**: `draft` / `in-review` / `accepted` / `rejected` / `shipped`
- **등급 목표**: `experimental` → `stable`
- **대상 경로**: ( ) `/admin/*`  ( ) `/s`  ( ) `/d`  ( ) `/hrd`  ( ) 공용 primitive

## 0. 라우팅 제1원칙 확인

- [ ] 대상 경로가 **실사용 경로** 다 ([`AGENTS.md`](../../../AGENTS.md) 의 "라우팅 제1원칙").
- [ ] Deprecated 경로 `(dashboard)/*`, `/survey`, `/respond`, `/api/respond/*`, `/api/surveys/*`, `/api/distributions/*` (cs-bridge 제외), `/api/reports/*` 를 touch 하지 않는다.

> [!WARNING]
> Deprecated 경로 대상이라면 이 RFC 는 자동 reject 다.

## 1. 동기

- 해결하려는 문제 1문장
- 같은 UX 반복 사례 (파일:라인 ≥ 2건 인용)
- `03-components.md` pattern 목록을 먼저 확인했는가? 있는데 왜 부족한가?

## 2. 설계

### Props
```ts
export interface <Name>Props {
  //
}
```

### 사용 예
```tsx
<Component … />
```

### 계층 선언
- primitive / composite / pattern 중 어디에 속하는가?
- 어느 primitive·composite 를 재사용하는가?
- 새로 만들 토큰이 있는가? 있다면 [`_templates/token-change.md`](./token-change.md) 도 동반 제출.

## 3. 접근성 계약

- 키보드: <탭 순서·단축키>
- ARIA: <role·label·live>
- 포커스 트랩 필요 여부
- `prefers-reduced-motion` 분기
- 대비비 (WCAG AA) 확인

## 4. UX 라이팅

- 기본 카피 키 (`src/messages/ko/*`) 에 추가/재사용할 키 나열
- 3요소(무슨 일·왜·다음 행동) 준수 여부

## 5. 변형·상태

| 상태 | 조건 | 시각 | 카피 |
|---|---|---|---|
| default | | | |
| loading | | | |
| empty | | | |
| error | | | |
| disabled | | | |

## 6. 테스트

- Playwright 경로 (있다면 스펙 파일명)
- axe 스냅샷 대상에 추가하는가?
- 단위 테스트 (가능하면 스냅샷 + interaction)

## 7. 이관·폐기 계획

- 이 컴포넌트로 대체되는 기존 구현 (파일:라인)
- 호환 기간: <몇 번의 릴리즈까지 둘 것인가>
- 제거 PR 체크리스트

## 8. 관련 토큰 / 문서

- [`02-tokens.md`](../02-tokens.md)
- [`03-components.md`](../03-components.md)
- [`08-accessibility.md`](../08-accessibility.md)

## 변경 이력

| 날짜 | 변경 | PR |
|---|---|---|
| YYYY-MM-DD | 초안 | — |

_라우팅 스코프: 실사용만 (`/admin/*`, `/s`, `/d`, `/hrd`)._
