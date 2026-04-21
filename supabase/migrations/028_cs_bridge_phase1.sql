-- =====================================================================
-- 028_cs_bridge_phase1.sql
-- Phase 1: cs-bridge API 연동을 위한 DB 확장
-- - cs_survey_targets: bridge writeback 필드 6개
-- - distribution_batches: 출처 추적 (manual | cs-bridge | cs-csv-import)
-- - cs_target_batches: 어떤 설문으로 발송할지 링크
-- =====================================================================

-- 1. cs_survey_targets: bridge 성공/실패 시 writeback 될 필드
ALTER TABLE public.cs_survey_targets
  ADD COLUMN IF NOT EXISTS distribution_id  uuid REFERENCES public.distributions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS survey_token     varchar(64),
  ADD COLUMN IF NOT EXISTS survey_url       varchar(500),
  ADD COLUMN IF NOT EXISTS dispatched_at    timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_channel varchar(20),
  ADD COLUMN IF NOT EXISTS dispatch_error   text;

CREATE INDEX IF NOT EXISTS idx_cs_targets_distribution
  ON public.cs_survey_targets(distribution_id);

CREATE INDEX IF NOT EXISTS idx_cs_targets_status
  ON public.cs_survey_targets(status);

-- 2. distribution_batches: 배치의 생성 경로 추적
ALTER TABLE public.distribution_batches
  ADD COLUMN IF NOT EXISTS source          varchar(40) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_batch_id uuid;

COMMENT ON COLUMN public.distribution_batches.source IS
  'manual | cs-bridge | cs-csv-import — 배부 배치의 생성 경로';

COMMENT ON COLUMN public.distribution_batches.source_batch_id IS
  'source=cs-bridge/csv-import 시 cs_target_batches.id 역참조';

CREATE INDEX IF NOT EXISTS idx_distribution_batches_source_batch
  ON public.distribution_batches(source_batch_id)
  WHERE source_batch_id IS NOT NULL;

-- 3. cs_target_batches: 이 배치가 발송할 설문 링크 (bridge 호출 시 필수)
--    실제 운영 설문 테이블은 edu_surveys (id uuid). Prisma legacy surveys(int) 아님.
ALTER TABLE public.cs_target_batches
  ADD COLUMN IF NOT EXISTS survey_id uuid REFERENCES public.edu_surveys(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.cs_target_batches.survey_id IS
  'Phase 1: 이 배치가 발송할 설문. edu_surveys(id) 참조. bridge API 호출 시 필수.';
