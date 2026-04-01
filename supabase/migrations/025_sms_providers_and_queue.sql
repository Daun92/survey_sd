-- ============================================================
-- 025: SMS 프로바이더, 템플릿, 발송 큐
-- ============================================================

-- ─── SMS 프로바이더 설정 ───
CREATE TABLE IF NOT EXISTS sms_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider_type VARCHAR(20) NOT NULL
    CHECK (provider_type IN ('aligo', 'naver_cloud', 'twilio')),

  -- Aligo 설정
  api_key TEXT,
  api_user_id VARCHAR(100),
  sender_phone VARCHAR(30),  -- 사전 등록된 발신번호

  -- 메타
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_sms_providers_default
  ON sms_providers (is_default) WHERE is_default = true;

ALTER TABLE sms_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_sms_providers" ON sms_providers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── SMS 템플릿 ───
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  body_text TEXT NOT NULL,
  message_type VARCHAR(10) DEFAULT 'SMS'
    CHECK (message_type IN ('SMS', 'LMS')),
  variables JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_sms_templates" ON sms_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 기본 SMS 템플릿 시드
INSERT INTO sms_templates (name, body_text, message_type, variables, is_default)
VALUES
(
  'CS 설문 안내 (기본)',
  '[{회사명}] 교육 만족도 설문
{담당자명}님, 설문에 참여해 주세요.
{설문링크}',
  'SMS',
  '["회사명", "담당자명", "설문링크"]'::jsonb,
  true
),
(
  'CS 설문 안내 (상세)',
  '[{회사명}] {과정명} 교육 만족도 설문

{담당자명}님 안녕하세요.
교육에 대한 소중한 의견을 부탁드립니다.

설문 참여: {설문링크}

감사합니다.',
  'LMS',
  '["회사명", "담당자명", "과정명", "설문링크"]'::jsonb,
  false
);

-- ─── SMS 발송 큐 ───
CREATE TABLE IF NOT EXISTS sms_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  distribution_id UUID REFERENCES distributions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES sms_templates(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(30) NOT NULL,
  recipient_name VARCHAR(100),
  body_text TEXT NOT NULL,
  message_type VARCHAR(10) DEFAULT 'SMS'
    CHECK (message_type IN ('SMS', 'LMS')),

  -- 스케줄링
  schedule_type VARCHAR(20) DEFAULT 'immediate'
    CHECK (schedule_type IN ('immediate', 'scheduled', 'trigger')),
  scheduled_at TIMESTAMPTZ,
  trigger_rule JSONB,

  -- 상태
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  sent_at TIMESTAMPTZ,

  -- 프로바이더 응답
  provider_message_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sms_queue_status_schedule
  ON sms_queue (status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_sms_queue_distribution
  ON sms_queue (distribution_id);

ALTER TABLE sms_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_sms_queue" ON sms_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
