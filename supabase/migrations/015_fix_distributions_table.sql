-- ============================================
-- 015: distributions 테이블 스키마 수정
-- ============================================
-- 기존 distributions 테이블이 구형 스키마(integer ID, customer_id 기반)로 되어 있어
-- batch_id 컬럼이 없는 문제 해결
-- distributions_legacy가 올바른 UUID 기반 스키마를 갖고 있었으므로 교체

-- 1. 구형 distributions 테이블 제거 (0 rows)
DROP TABLE IF EXISTS distributions CASCADE;

-- 2. distributions_legacy를 distributions로 이름 변경
ALTER TABLE distributions_legacy RENAME TO distributions;

-- 3. 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_distributions_survey ON distributions(survey_id);
CREATE INDEX IF NOT EXISTS idx_distributions_batch ON distributions(batch_id);
CREATE INDEX IF NOT EXISTS idx_distributions_token ON distributions(unique_token);
CREATE INDEX IF NOT EXISTS idx_distributions_status ON distributions(status);

-- 4. RLS 활성화
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책
DROP POLICY IF EXISTS "auth_manage_distributions_legacy" ON distributions;
DROP POLICY IF EXISTS "auth_manage_distributions" ON distributions;
CREATE POLICY "auth_manage_distributions" ON distributions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_own_distribution_legacy" ON distributions;
DROP POLICY IF EXISTS "anon_read_own_distribution" ON distributions;
CREATE POLICY "anon_read_own_distribution" ON distributions
  FOR SELECT TO anon
  USING (unique_token IS NOT NULL);

DROP POLICY IF EXISTS "anon_update_own_distribution_legacy" ON distributions;
DROP POLICY IF EXISTS "anon_update_own_distribution" ON distributions;
CREATE POLICY "anon_update_own_distribution" ON distributions
  FOR UPDATE TO anon
  USING (unique_token IS NOT NULL)
  WITH CHECK (unique_token IS NOT NULL);
