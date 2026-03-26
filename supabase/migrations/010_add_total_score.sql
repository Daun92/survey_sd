-- =============================================
-- 010: total_score 컬럼 추가 및 기존 데이터 백필
-- =============================================

ALTER TABLE edu_submissions ADD COLUMN IF NOT EXISTS total_score NUMERIC DEFAULT NULL;

-- 기존 응답의 total_score 계산 (answers JSONB의 숫자값 합산)
UPDATE edu_submissions SET total_score = (
  SELECT COALESCE(SUM(val::numeric), 0)
  FROM jsonb_each_text(answers) AS t(key, val)
  WHERE val ~ '^\d+(\.\d+)?$'
) WHERE total_score IS NULL;
