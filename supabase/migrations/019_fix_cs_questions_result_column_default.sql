-- result_column NOT NULL인데 default가 없어서 문항 추가 시 에러 발생
ALTER TABLE cs_survey_questions ALTER COLUMN result_column SET DEFAULT '';
