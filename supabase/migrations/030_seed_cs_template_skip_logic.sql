-- =============================================
-- 030: 기본 CS 템플릿 에코시스템 분기 seed
-- 에코Q1 이 "사용하지 않음(value=6)" 일 때만 에코Q1-1, 에코기타 를 노출
-- =============================================
--
-- 목적:
--   기본(is_system=true) 템플릿 자체가 skip_logic 을 가지고 있어야
--   quick-create → edu_surveys 변환 시 일반 remap 로직으로 분기가 반영된다.
--   종전에는 quick-create 서버 액션이 "에코Q1" 질문코드를 하드코딩으로 감지해
--   분기를 주입했으나, 템플릿 수준에서 관리 가능하도록 이관.
--
-- 대상 템플릿: classroom, smart (eco 섹션이 존재하는 두 기본 템플릿)

DO $$
DECLARE
  rec RECORD;
  eco_q1_id UUID;
BEGIN
  FOR rec IN
    SELECT id, division
      FROM cs_survey_templates
     WHERE is_system = true
       AND division IN ('classroom', 'smart')
  LOOP
    -- 에코Q1 의 template_id + question_no 기준 id 조회
    SELECT id INTO eco_q1_id
      FROM cs_survey_questions
     WHERE template_id = rec.id
       AND question_no = '에코Q1'
     LIMIT 1;

    IF eco_q1_id IS NULL THEN
      CONTINUE;
    END IF;

    -- 에코Q1-1, 에코기타 에 skip_logic 설정 (이미 있으면 덮어씀)
    UPDATE cs_survey_questions
       SET skip_logic = jsonb_build_object(
             'show_when', jsonb_build_object(
               'question_id', eco_q1_id::text,
               'operator',    'equals',
               'value',       6
             )
           )
     WHERE template_id = rec.id
       AND question_no IN ('에코Q1-1', '에코기타');
  END LOOP;
END$$;
