-- CS 문항에 조건부 표시(skip_logic), 필수 여부(is_required), 메타데이터(metadata) 추가
ALTER TABLE cs_survey_questions ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true;
ALTER TABLE cs_survey_questions ADD COLUMN IF NOT EXISTS skip_logic JSONB;
ALTER TABLE cs_survey_questions ADD COLUMN IF NOT EXISTS metadata JSONB;
