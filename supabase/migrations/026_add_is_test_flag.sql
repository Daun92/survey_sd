-- =============================================
-- 026: 테스트/참조 링크 구분을 위한 is_test 플래그 추가
-- distribution_batches, edu_submissions 테이블에 추가
-- 기존 데이터는 모두 false (정상 집계 대상)
-- =============================================

ALTER TABLE distribution_batches
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

ALTER TABLE edu_submissions
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

COMMENT ON COLUMN distribution_batches.is_test IS '테스트/참조용 배치 여부. true이면 리포트 집계에서 제외';
COMMENT ON COLUMN edu_submissions.is_test IS '테스트/참조용 응답 여부. true이면 리포트 집계에서 제외';

-- 집계 쿼리 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_edu_submissions_is_test ON edu_submissions(is_test) WHERE is_test = true;
