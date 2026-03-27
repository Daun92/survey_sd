-- ============================================
-- 009: 응답자 마스터 + 배포 추적 테이블
-- ============================================
-- 6개월 룰, 이메일 발송, 리마인더, 응답률 추적의 기반

-- ============================================
-- 1. 응답자 마스터 (respondents)
-- ============================================
CREATE TABLE IF NOT EXISTS respondents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(30),
  department VARCHAR(100),
  position VARCHAR(100),
  -- 6개월 룰: 마지막 CS설문 발송일
  last_cs_survey_sent_at TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_respondents_org ON respondents(organization_id);
CREATE INDEX idx_respondents_email ON respondents(email);
CREATE INDEX idx_respondents_last_cs ON respondents(last_cs_survey_sent_at);

-- ============================================
-- 2. 배포 배치 (distribution_batches)
-- ============================================
CREATE TABLE IF NOT EXISTS distribution_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES edu_surveys(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL DEFAULT 'email',
  -- email, sms, qr, manual
  created_by UUID REFERENCES user_profiles(id),
  total_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dist_batches_survey ON distribution_batches(survey_id);

-- ============================================
-- 3. 개별 배포 추적 (distributions)
-- ============================================
CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES distribution_batches(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES edu_surveys(id) ON DELETE CASCADE,
  respondent_id UUID REFERENCES respondents(id) ON DELETE SET NULL,
  -- 응답자 정보 (respondent 없이도 직접 발송 가능)
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(100),
  -- 토큰 기반 접근
  unique_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- 채널
  channel VARCHAR(20) NOT NULL DEFAULT 'email',
  -- 상태 추적
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, sent, opened, started, completed, bounced, failed
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- 리마인더
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  -- 메타데이터
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_distributions_survey ON distributions(survey_id);
CREATE INDEX idx_distributions_respondent ON distributions(respondent_id);
CREATE INDEX idx_distributions_token ON distributions(unique_token);
CREATE INDEX idx_distributions_status ON distributions(status);
CREATE INDEX idx_distributions_batch ON distributions(batch_id);
-- 리마인더 크론잡 최적화: 발송됨 + 미완료 + 리마인더 가능
CREATE INDEX idx_distributions_reminder ON distributions(status, reminder_count, last_reminder_at)
  WHERE status IN ('sent', 'opened', 'started') AND reminder_count < 3;

-- ============================================
-- 4. RLS 정책
-- ============================================
ALTER TABLE respondents ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자: 전체 접근
CREATE POLICY "auth_manage_respondents" ON respondents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_manage_dist_batches" ON distribution_batches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_manage_distributions" ON distributions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 익명 사용자: 자기 토큰의 distribution만 조회 + 상태 업데이트
CREATE POLICY "anon_read_own_distribution" ON distributions
  FOR SELECT TO anon
  USING (unique_token IS NOT NULL);

CREATE POLICY "anon_update_own_distribution" ON distributions
  FOR UPDATE TO anon
  USING (unique_token IS NOT NULL)
  WITH CHECK (unique_token IS NOT NULL);

-- ============================================
-- 5. 6개월 룰 체크 함수
-- ============================================
CREATE OR REPLACE FUNCTION check_cs_sendable(p_respondent_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_sent TIMESTAMPTZ;
BEGIN
  SELECT last_cs_survey_sent_at INTO v_last_sent
  FROM respondents
  WHERE id = p_respondent_id;

  -- 발송 이력 없으면 발송 가능
  IF v_last_sent IS NULL THEN
    RETURN true;
  END IF;

  -- 180일(6개월) 경과 여부
  RETURN (NOW() - v_last_sent) > INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 6. 응답 완료 시 distribution 상태 자동 업데이트 뷰
-- ============================================
CREATE OR REPLACE VIEW v_distribution_stats AS
SELECT
  db.id AS batch_id,
  db.survey_id,
  db.channel,
  db.created_at,
  COUNT(d.id) AS total,
  COUNT(d.id) FILTER (WHERE d.status = 'sent') AS sent,
  COUNT(d.id) FILTER (WHERE d.status = 'opened') AS opened,
  COUNT(d.id) FILTER (WHERE d.status IN ('started', 'completed')) AS started,
  COUNT(d.id) FILTER (WHERE d.status = 'completed') AS completed,
  COUNT(d.id) FILTER (WHERE d.status = 'bounced') AS bounced,
  CASE
    WHEN COUNT(d.id) > 0
    THEN ROUND(COUNT(d.id) FILTER (WHERE d.status = 'completed')::NUMERIC / COUNT(d.id) * 100, 1)
    ELSE 0
  END AS completion_rate
FROM distribution_batches db
LEFT JOIN distributions d ON d.batch_id = db.id
GROUP BY db.id, db.survey_id, db.channel, db.created_at;
