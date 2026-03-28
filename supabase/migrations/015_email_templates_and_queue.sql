-- ============================================
-- 015: 메일 템플릿 + 발송 큐
-- ============================================

-- ============================================
-- 1. 메일 템플릿 (email_templates)
-- ============================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  education_type VARCHAR(50),  -- 교육유형별 매핑 (null = 기본 템플릿)
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 발송 큐 (email_queue)
-- ============================================
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID REFERENCES distributions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(100),
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  -- 발송 유형
  schedule_type VARCHAR(20) DEFAULT 'immediate',  -- immediate / scheduled / trigger
  scheduled_at TIMESTAMPTZ,                        -- 예약 발송 시각
  trigger_rule JSONB,                              -- {"type":"after_education_end","days":1}
  -- 상태
  status VARCHAR(20) DEFAULT 'pending',  -- pending / processing / sent / failed / cancelled
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- cron 조회 최적화
CREATE INDEX idx_email_queue_status_schedule ON email_queue(status, scheduled_at)
  WHERE status = 'pending';
-- 배포별 큐 조회
CREATE INDEX idx_email_queue_distribution ON email_queue(distribution_id);

-- ============================================
-- 3. RLS 정책
-- ============================================
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_manage_email_templates" ON email_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_manage_email_queue" ON email_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 4. 기본 CS 설문 안내 템플릿 시드
-- ============================================
INSERT INTO email_templates (name, subject, body_html, variables, education_type, is_default)
VALUES (
  'CS 설문 안내 (기본)',
  '[{회사명}] {과정명} 교육 만족도 설문 안내',
  '<div style="font-family: ''Malgun Gothic'', ''맑은 고딕'', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
    <h2 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 20px;">교육 만족도 설문 안내</h2>
    <p style="color: #4a4a4a; line-height: 1.8; margin: 0;">
      안녕하세요, <strong>{담당자명}</strong>님.<br/>
      <strong>{회사명}</strong>에서 진행된 <strong>{과정명}</strong> 교육에 참여해 주셔서 감사합니다.
    </p>
  </div>

  <div style="padding: 0 8px;">
    <p style="color: #4a4a4a; line-height: 1.8;">
      교육의 질적 향상을 위해 간단한 설문에 응답해 주시면 감사하겠습니다.<br/>
      소요 시간은 약 <strong>3~5분</strong>입니다.
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="{설문링크}" style="display: inline-block; background: #0d9488; color: #ffffff; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
        설문 참여하기
      </a>
    </div>

    <p style="color: #888; font-size: 13px; line-height: 1.6;">
      ※ 본 설문은 개인별 고유 링크로 발송되었으며, 1회만 응답 가능합니다.<br/>
      ※ 응답하신 내용은 교육 품질 개선 목적으로만 활용됩니다.
    </p>
  </div>

  <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 16px;">
    <p style="color: #aaa; font-size: 12px; text-align: center; margin: 0;">
      본 메일은 발신 전용입니다. 문의사항은 담당 AM에게 연락해 주세요.
    </p>
  </div>
</div>',
  '["회사명","담당자명","과정명","설문링크","교육종료일"]',
  NULL,
  true
);
