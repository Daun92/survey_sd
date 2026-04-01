-- 이메일 제공자 설정 테이블
CREATE TABLE IF NOT EXISTS email_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('hiworks', 'smtp', 'gmail', 'outlook')),
  -- SMTP 설정
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_secure BOOLEAN DEFAULT false,
  smtp_user VARCHAR(255),
  smtp_password TEXT,
  -- HiWorks 설정
  api_token TEXT,
  api_user_id VARCHAR(100),
  -- 발신자 정보
  from_name VARCHAR(100),
  from_email VARCHAR(255),
  -- 메타
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 기본 제공자는 하나만 허용
CREATE UNIQUE INDEX idx_email_providers_default
  ON email_providers (is_default) WHERE is_default = true;

-- RLS
ALTER TABLE email_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage email providers"
  ON email_providers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
