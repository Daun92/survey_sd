# supabase_migrations — MCP 적용된 SQL reference

표준 위치는 `supabase/migrations/` (타임스탬프 명명, `npx supabase db push` 적용 대상). 이 디렉토리는 **MCP `apply_migration` 으로 일회성 적용된 SQL 의 reference** — git 에는 두되 CLI `db push` 는 건너뛴다.

## 들어있는 것

| 파일 | 적용 시점 | 적용 방식 | 설명 |
|---|---|---|---|
| `reseed_step1_meta.sql` ~ `reseed_step4_items_p4_p5.sql` | 2026-05-13 | MCP `apply_migration` (4 청크) | 22회 round/parts/items reseed (status='draft' 로 초기화) |
| `reseed_hrd_round_22.sql` | (compose) | 통합본 | 4 청크의 통합 — apply 안 됨 |
| `seed_21th_step1_meta.sql` ~ `seed_21th_step4_items_p4_p5.sql` | 2026-05-13 | MCP `apply_migration` (4 청크) | **21회 baseline 시드** (round=21 / year=2025 / parts 5 / items 225) |
| `seed_21th_respondents*.sql` | (생성됨, 미적용) | — | A2 응답자 SQL — 실제 적용은 `import_21th_all.py` (Supabase REST) 로 진행, SQL 은 reference 만 |
| `backups/hrd_20260513_pre_reseed_*.json|tsv` | 2026-05-13 | export | 22회 시드 더미 삭제 전 메타 + items 구조 백업 |

## 21회 import 절차 (재현 시)

본 PR 머지 후 21회 baseline 을 다른 환경에서 재현하려면:

```bash
# 1) round + parts + items (마이그레이션 4 청크)
#    Supabase Dashboard SQL Editor 또는 MCP apply_migration 으로 차례대로 실행:
#      seed_21th_step1_meta.sql
#      seed_21th_step2_items_p1_p2.sql
#      seed_21th_step3_items_p3.sql
#      seed_21th_step4_items_p4_p5.sql

# 2) 응답자 (303명) + 응답 데이터 (~48,504 rows)
#    참고_2025/제21회 인재개발 실태조사_All.xlsx 필요
#    .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
python ../../../hrd_report_template/scripts/import_21th_all.py
```

`import_21th_all.py` 위치: `D:\00.26년업무\07.HR실태조사\hrd_report_template\scripts\` (별도 repo). 핵심은 `cast_value()` 의 answer_type 별 분기 — 22회 응답 들어올 때도 같은 변환 규약 사용.

## 향후 컨벤션

- **신규 마이그레이션** (실제 production 적용 대상): 반드시 `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql` 형식. `npx supabase migration new <name>` 으로 생성.
- 본 `supabase_migrations/` 는 점진적으로 비워나가 archive 로 이동 (혹은 docs/archives/ 로) 검토.
- 이미 MCP 로 적용된 마이그레이션을 다른 환경에 재현할 일은 거의 없지만, 본 README + SQL 파일은 그 경우의 reference 자료.
