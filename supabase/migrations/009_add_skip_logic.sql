-- =============================================
-- 009: 문항 조건부 분기 (skip logic) 지원
-- edu_questions 테이블에 skip_logic JSONB 컬럼 추가
-- =============================================

ALTER TABLE edu_questions
  ADD COLUMN IF NOT EXISTS skip_logic JSONB DEFAULT NULL;

COMMENT ON COLUMN edu_questions.skip_logic IS '조건부 표시 로직. 예: {"show_when": {"question_id": "uuid", "operator": "equals", "value": 6}}';
