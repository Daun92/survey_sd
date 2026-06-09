# 22회 도구 준비 체크리스트

> raw 도착(예상 2026-07~08) 전에 단계 2·4 도구가 동작 가능한 상태로 준비. 단계 5 는 raw 도착 후에도 진행 가능.

## 진척 상태

| 단계 | 도구·문서 | 상태 | 산출물 위치 |
|---|---|---|---|
| 골격 | 디렉토리 구조 | ✅ 완료 | `22회_2026/` |
| 골격 | README, WORKFLOW, READINESS | ✅ 완료 | `README.md`, `docs/` |
| 골격 | reference 21회 4개 자료 복사 | ✅ 완료 | `reference/` |
| 0 | survey 초안 v0.2 배치 | ✅ 완료 | `0_survey/survey_draft_v0.2.pptx` |
| 0 | `stage0_diff_survey.py` | ⬜ | `scripts/` |
| 0 | `codebook_22th.xlsx` patch | ⬜ | `0_survey/` |
| 0 | `analysis_guide_22th.xlsx` patch | ⬜ | `0_survey/` |
| 2 | `stage2_validate_raw.py` | ⬜ | `scripts/` |
| 2 | `stage2_flag_outliers.py` | ⬜ | `scripts/` |
| 2 | `config/outlier_rules.yaml` | ⬜ | `config/` |
| 2 | `config/correction_patterns.yaml` (21회 학습) | ⬜ | `config/` |
| 3 | `docs/CLEANING_MANUAL.md` (분석가용) | ⬜ | `docs/` |
| 4 | `config/segments.yaml` (분류) | ⬜ | `config/` |
| 4 | `config/chart_specs.yaml` (도표 48개) | ⬜ | `config/` |
| 4 | `stage4_build_kim_xlsx.py` | ⬜ | `scripts/` |
| 4 | `stage4_extract_chart_data.py` | ⬜ | `scripts/` |
| 4 | 21회 reverse-run 검증 | ⬜ | `tests/test_stage4_with_21th.py` |
| 5 | `master_22th.pptx` (자동화 친화 95%+) | ⬜ | `5_report/` (`..\hrd_report_template\templates\master_2026.pptx` 참조) |
| 5 | `stage5_render_pptx.py` (hrd_report_template wrapping) | ⬜ | `scripts/` |
| 5 | `run_pipeline.py` orchestrator | ⬜ | `scripts/` |

## 작업 순서 (raw 도착 전)

1. 단계 0 (설문 초안 검수) — 변경분 식별·codebook·가이드 patch
2. 단계 4 도구 (config + build_kim + chart_data) → 21회 reverse-run 검증
3. 단계 2 도구 (validate + flag_outliers) + correction_patterns 21회 학습
4. 단계 3 매뉴얼 (CLEANING_MANUAL.md)
5. 단계 5 도구 (master 점검 + render_pptx wrapping) + orchestrator

순서 근거:
- 0 은 다른 모든 단계의 사양원 (codebook·가이드)
- 4 는 21회 데이터로 검증 가능 (정답이 김태웅 xlsx 에 존재) → 우선
- 2 는 4 다음 — outlier_rules 가 4 검증 과정에서 발견되는 정정 패턴을 반영
- 3 매뉴얼은 모든 자동 도구가 완성된 뒤 작성하면 더 정확
- 5 는 마지막 — raw 도착 후에도 마무리 가능
