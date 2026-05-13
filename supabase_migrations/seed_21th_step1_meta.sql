-- name: seed_21th_step1_meta
-- 21회 (2025년 발간) round + 5 parts 시드.
DELETE FROM public.hrd_consulting_reports
 WHERE round_id IN (SELECT id FROM public.hrd_survey_rounds WHERE round_number=21);
DELETE FROM public.hrd_benchmark_cache
 WHERE round_id IN (SELECT id FROM public.hrd_survey_rounds WHERE round_number=21);
DELETE FROM public.hrd_responses
 WHERE round_id IN (SELECT id FROM public.hrd_survey_rounds WHERE round_number=21);
DELETE FROM public.hrd_respondents
 WHERE round_id IN (SELECT id FROM public.hrd_survey_rounds WHERE round_number=21);
DELETE FROM public.hrd_survey_items
 WHERE round_id IN (SELECT id FROM public.hrd_survey_rounds WHERE round_number=21);
DELETE FROM public.hrd_survey_parts
 WHERE round_id IN (SELECT id FROM public.hrd_survey_rounds WHERE round_number=21);
DELETE FROM public.hrd_survey_rounds WHERE round_number=21;

WITH new_round AS (
  INSERT INTO public.hrd_survey_rounds
    (round_number, year, title, description, status, target_count, settings)
  VALUES (
    21, 2025,
    '제21회 인적자원개발 실태조사',
    '2024년도 교육 활동 기준. baseline (참고_2025/제21회_All.xlsx 620 응답 중 완료 303명) 분석 비교용.',
    'closed',
    300,
    jsonb_build_object(
      'source_xlsx',     '참고_2025/제21회 인재개발 실태조사_All.xlsx',
      'baseline_for',    22,
      'imported_at',     '2026-05-13',
      'codebook_source', 'data/2025/codebook_v2.xlsx'
    )
  )
  RETURNING id
)
INSERT INTO public.hrd_survey_parts (round_id, part_code, part_name, sort_order, description, is_active)
SELECT new_round.id, parts.part_code, parts.part_name, parts.sort_order, parts.description, true
FROM new_round, (VALUES
  ('p1', 'I. 교육관련 지표',  1, '거시지표·교육비·교육시간·인원/지출 비율·투자 효과 (2024년도 기준)'),
  ('p2', 'II. HRD 현황',      2, '조직·경영층 관심·인프라·LMS·HRD 제도·성과지표·아웃소싱·개선'),
  ('p3', 'III. HRD 활동',     3, '교육내용·지원활동·학습기법·교육형태·교육평가·원격교육'),
  ('p4', 'IV. HRD 이슈',      4, '향후 1~3년 주요 이슈 30항목·성과관리 연계·방해 원인'),
  ('p5', 'V. AI 도입과 활용', 5, 'AI 도입과 활용 — 21회 baseline')
) AS parts(part_code, part_name, sort_order, description);
