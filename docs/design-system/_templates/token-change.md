# Token RFC — <토큰 이름>

> 이 템플릿은 [`02-tokens.md`](../02-tokens.md) 의 3계층·네이밍 규약을 따릅니다. 신규·변경·폐기 토큰 제안 시 복사해 사용하세요.

- **제안자**: <이름>
- **상태**: `draft` / `in-review` / `accepted` / `rejected` / `shipped`
- **계층**: ( ) primitive  ( ) semantic  ( ) component
- **종류**: ( ) color  ( ) space  ( ) radius  ( ) shadow  ( ) motion

## 1. 동기

- 해결하려는 반복 현상 (파일:라인 ≥ 2건 인용)
- 기존 토큰으로 표현 불가한 이유

## 2. 네이밍

`--<layer>-<intent>-<role>-<variant>-<state>`

| 신규 이름 | 값 (light) | 값 (dark) | `.expert-theme` alias |
|---|---|---|---|
| | | | |

- 기존 토큰(primitive)을 참조하는가? 참조 체인을 써라 (`--color-action-primary → var(--primary)`).

## 3. 대비비·접근성

- 대비비 계산: 주 사용 전경/배경 쌍에 대해 4.5:1 이상인지 수치로 적는다.
- 색약(Protanopia / Deuteranopia) 구분 가능성 확인.
- oklch L 값 및 C 값 기록 (접근성 재검토용).

## 4. 사용처 (적용 대상)

- 어느 컴포넌트/파일에서 이 토큰을 소비하게 되나?
- Before / After 코드 예시 최소 1쌍.

```tsx
// Before — <파일:라인>

// After
```

## 5. Tailwind 노출 여부

- [ ] `@theme inline` 블록에 `--color-*` / `--space-*` / ... 로 등록해 자동 utility 생성
- [ ] 수동 참조만 (`bg-[--<token>]`)

선택 이유:

## 6. 이관 계획

- 대체되는 기존 raw palette / arbitrary value 목록 (파일:라인)
- 제거 시점 (몇 번째 릴리즈)

## 7. 검증

- [ ] 값이 `02-tokens.md` 네이밍과 충돌하지 않는다.
- [ ] `99-glossary.md` 에 이름을 등록했다.
- [ ] 대비비·색약 검증 통과.
- [ ] Lint 규칙이 새 토큰을 raw palette 대신 제안할 수 있도록 업데이트됐다.

## 8. 관련 문서

- [`02-tokens.md`](../02-tokens.md)
- [`08-accessibility.md`](../08-accessibility.md)
- [`99-glossary.md`](../99-glossary.md)

## 변경 이력

| 날짜 | 변경 | PR |
|---|---|---|
| YYYY-MM-DD | 초안 | — |

_라우팅 스코프: 실사용만 (`/admin/*`, `/s`, `/d`, `/hrd`)._
