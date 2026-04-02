-- ============================================================
-- 027: sms_providers에 ppurio 프로바이더 타입 추가
-- ============================================================

-- 기존 CHECK 제약조건 삭제 후 ppurio 포함하여 재생성
ALTER TABLE sms_providers
  DROP CONSTRAINT IF EXISTS sms_providers_provider_type_check;

ALTER TABLE sms_providers
  ADD CONSTRAINT sms_providers_provider_type_check
  CHECK (provider_type IN ('aligo', 'ppurio', 'naver_cloud', 'twilio'));

-- sms_queue에 provider_message_key 컬럼 추가 (뿌리오 예약 취소용 messageKey 저장)
ALTER TABLE sms_queue
  ADD COLUMN IF NOT EXISTS provider_message_key VARCHAR(100);

COMMENT ON COLUMN sms_queue.provider_message_key IS '뿌리오 messageKey — 예약 발송 취소 시 사용';
