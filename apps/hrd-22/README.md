# 제22회 인재개발 실태조사 (2026 발간)

> **레포 편입 (2026-06-09)** — 이 폴더는 `survey_sd` 모노레포에 편입된 **코드 사본**입니다.
> `apps/cs-master` 와 동일하게 사내 시스템(apihome / apps.exc.co.kr) 접근용 오프라인 파이프라인이라 **Vercel 배포 대상이 아니며**, 코드 일원화·DB SSOT 통합 목적으로 함께 둡니다.
>
> - **데이터·산출물·자격증명의 진실원**: 원 작업 폴더 `D:\00.26년업무\07.HR실태조사\22회_2026\`
>   (raw/검증/정제/집계/리포트, `creds/`, `0_survey` xlsx 등은 그쪽에만 — 이 사본엔 `.gitignore` 로 제외)
> - **코드의 진실원**: 본 폴더(`apps/hrd-22/`). 코드 수정은 여기서 하고 원 폴더로 동기화하면 드리프트가 없다.
> - **DB SSOT**: 모노레포 root 의 `supabase/migrations/` (신규 SQL 은 `apply_migration` MCP).
> - **22회 → /admin/hrd 적재**: `docs/SUPABASE_INGEST_22th.md` 참조 (21회 `import_21th_all.py` 청사진 재사용).

22회 raw 응답이 도착하면 즉시 가동되는 단계별 파이프라인 + 분석가 워크스페이스.

## 목표

26년 서베이 결과를 **정확하고 디테일이 반영된 오차 없는** 리포트로 완성. 자동화는 도구일 뿐 KPI 가 아님.

## 구조 (단계 = 폴더 = 산출물)

```
0_survey/        설문 초안 + 22회 codebook + 분석가이드
1_raw/           응답 수집 결과 (수집 종료 후 도착)
2_validated/     자동 검증·이상치 플래그
3_cleaned/       분석가 검수 정제 DB
4_aggregated/    16시트 집계 + 도표 데이터
5_report/        PPT + 최종 PDF
scripts/         단계별 실행 스크립트 (stage0~5 prefix)
config/          매년 조정 가능한 매핑·규칙 (YAML)
docs/            워크플로우·매뉴얼·체크리스트
reference/       21회 자료 (검증·비교용)
tests/           회귀·검증 테스트
workspace/       임시 작업·dump (산출물 아님)
```

## 진척 확인

```powershell
# 진척 데이터 갱신 후 MD + HTML 동기화
python scripts/update_dashboard.py

# 갱신과 동시에 브라우저로 대시보드 열기
python scripts/update_dashboard.py --open

# 작업 이력 1건 추가
python scripts/add_worklog.py --stage 4 --type decision \
    --title "집계기 v1 범위 확정" --desc "자동 영역만 처리, 산업 분류는 v2" \
    --artifacts "config/segments.yaml"
```

- **진척 데이터 소스**: [progress.yaml](progress.yaml) — 단계별 산출물 status (편집 단위)
- **작업 이력 소스**: [worklog.yaml](worklog.yaml) — 작업 결정·발견·산출물 시간순 기록
- **MD 진척표**: [docs/PROGRESS.md](docs/PROGRESS.md) (자동 생성)
- **HTML 대시보드**: [dashboard/index.html](dashboard/index.html) (단계 카드 + 마일스톤 + worklog 타임라인)

## 빠른 시작

```powershell
# 단계 0: 설문 초안 → codebook·가이드 patch
python scripts/stage0_diff_survey.py
python scripts/stage0_patch_codebook.py
python scripts/stage0_build_guide.py

# (응답 수집 종료 후 raw 도착)
# 1_raw/raw_22th.xlsx 배치

# 단계 2: 자동 검증
python scripts/stage2_validate_raw.py
python scripts/stage2_flag_outliers.py
# → 2_validated/outlier_report.xlsx 를 분석가에게 전달

# 단계 3: 분석가 검수 (수기, docs/CLEANING_MANUAL.md 참조)
# → 3_cleaned/All_확인완료_22th.xlsx

# 단계 4: 집계
python scripts/stage4_build_kim_xlsx.py
python scripts/stage4_extract_chart_data.py

# 단계 5: PPT 생성 + 검수 + PDF
python scripts/stage5_render_pptx.py
# → 5_report/result_22th.pptx → 디자이너 검수 → result_22th.pdf
```

전체 한 번에:
```powershell
python scripts/run_pipeline.py --stages 2,4   # raw 도착 후 자동 단계
```

## 진입 문서

- 워크플로우 전체: [docs/WORKFLOW.md](docs/WORKFLOW.md)
- 도구 준비 체크리스트: [docs/READINESS.md](docs/READINESS.md)
- 분석가 검수 매뉴얼: [docs/CLEANING_MANUAL.md](docs/CLEANING_MANUAL.md)

## 다른 자산과의 관계

- `..\hrd_report_template\` — 다년도 공용 자동화 파이프라인 (PPT 생성 부분 import 재사용)
- `..\참고_2025\analyis\` — 21회 원본 5개 자료. `reference/` 폴더에 사본 보관 중

## 일정 (현재 추정)

| 시점 | 단계 |
|---|---|
| 2026-05 (현재) | 설문 초안 v0.2 확보. 단계 0 도구 준비 중 |
| 2026-06 중순 | 응답 수집 시작 |
| 2026-07~08 | 응답 수집 종료 → 단계 2~3 |
| 2026-08~09 | 단계 4~5 → 발간 |
