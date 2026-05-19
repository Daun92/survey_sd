-- 설문 데이터 정합성 일괄 정리.
--
-- (D2) edu_questions.options — jsonb 컬럼이지만 historical 코드(addQuestion 등)가
--      JSON.stringify 결과를 그대로 insert 해서 모든 행이 jsonb 의 `string` 타입으로
--      저장돼 있었음 (예: '"[\"처음\",\"1년미만\",...]"'). 본 마이그레이션과 함께
--      커밋되는 코드 fix(F1) 가 신규 저장을 array 로 정상화. 본 SQL 은 기존 행을
--      array 형태로 일괄 정규화.
--
-- (D3) cs_survey_questions.response_options — text 컬럼인데 일부 row 가 "/"-join
--      형태가 아니라 JSON 배열 string ('["처음","1년미만",...]') 으로 저장돼 있어
--      커스텀 템플릿 상세 화면에서 "단일 응답지" 처럼 한 줄로 합쳐 보이는 증상의
--      원인. 안전하게 JSON parsing 가능한 행만 "/"-join 으로 정규화.
--
-- (D1) edu_surveys/a6e983a0 (5월 19일 draft 복제본) 의 에코 섹션 source 데이터 복구
--      + CS 템플릿 source 의 likert_6 → likert_5 정정 (재발 차단).
--      4월 20일 이후 source 설문(c0dbfb7d / 4ea36f7f) 의 에코Q1 이 likert_6 로
--      만들어진 진짜 원인은 SurveyEditor 가 아니라 cs_survey_questions 의 두 템플릿
--      (CS 만족도 조사 집체 / 스마트훈련) 에 likert_6 가 박혀 있어서, quick-create
--      경로로 edu_questions 에 그대로 전파된 것. 사용자 의도는 5점 리커트.
--      closed 응답 설문 (c0dbfb7d, 4ea36f7f) 은 데이터 보존을 위해 손대지 않고
--      draft 인 a6e983a0 + 양쪽 CS 템플릿 source 만 정정. (참고 — 원본
--      d72dcd69 / 3cfa1697 가 정상 형태였음)
--      F4(SurveyEditor 에 likert_6 옵션 추가) 코드 변경이 함께 들어가 closed 설문
--      에 남아 있는 likert_6 행도 화면에서 정상 표시됨.

-- ─────────────────────────────────────────────────────────
-- D2. edu_questions.options 정규화
-- ─────────────────────────────────────────────────────────
UPDATE edu_questions
SET options = (options #>> '{}')::jsonb
WHERE jsonb_typeof(options) = 'string'
  AND (options #>> '{}') LIKE '[%';

-- ─────────────────────────────────────────────────────────
-- D3. cs_survey_questions.response_options 정규화
--     JSON 배열 string → "/"-join 형태로 변환. parsing 실패 행은 그대로 둠.
-- ─────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
  joined text;
BEGIN
  FOR r IN
    SELECT id, response_options
    FROM cs_survey_questions
    WHERE response_options LIKE '[%'
      AND response_options LIKE '%]'
  LOOP
    BEGIN
      SELECT string_agg(value, '/')
        INTO joined
        FROM jsonb_array_elements_text(r.response_options::jsonb);
      IF joined IS NOT NULL THEN
        UPDATE cs_survey_questions
           SET response_options = joined
         WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- 이미 "/" 구분 형식이거나 잘못된 JSON 이면 그대로 둠
      NULL;
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────
-- D1. a6e983a0 복제본 에코 섹션 복구 + CS 템플릿 source 정정 (β 범위)
-- ─────────────────────────────────────────────────────────
-- (D1-a) a6e983a0 의 에코Q1: likert_6 → likert_5
UPDATE edu_questions
SET question_type = 'likert_5'
WHERE id = 'e9c5b070-7150-4445-8a36-54a1dc642638'
  AND survey_id = 'a6e983a0-4fee-41b7-86cd-e5838c02a70a'
  AND question_type = 'likert_6';

-- (D1-b) a6e983a0 의 에코Q1-1: skip_logic 부모를 에코사용(yes_no, value=2 아니오) 로
UPDATE edu_questions
SET skip_logic = jsonb_build_object(
  'show_when',
  jsonb_build_object(
    'value',       2,
    'operator',    'equals',
    'question_id', 'def201c4-400d-486c-9d06-022046bf27ad'::text
  )
)
WHERE id = '8f62d535-be11-4bfa-9a32-23bcfa44285f'
  AND survey_id = 'a6e983a0-4fee-41b7-86cd-e5838c02a70a';

-- (D1-c) CS 템플릿 source 의 likert_6 → likert_5
--        영향: cs_survey_questions 의 "CS 만족도 조사 (집체)" / "(스마트훈련)"
--        에코Q1 2 행. 향후 quick-create 시 likert_5 로 들어옴.
--        closed 설문에 남아 있는 likert_6 행은 F4 (SurveyEditor 옵션 추가) 로 화면 표시 유지.
UPDATE cs_survey_questions
SET question_type = 'likert_5'
WHERE question_type = 'likert_6';
