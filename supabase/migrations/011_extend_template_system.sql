-- =============================================
-- 011: 템플릿 시스템 확장 (사용자 생성/복제/보관)
-- =============================================

-- 시스템 템플릿 구분 + 생성자 추적
ALTER TABLE cs_survey_templates ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
ALTER TABLE cs_survey_templates ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT NULL;

-- 기존 6개 시드 템플릿을 시스템 템플릿으로 표시
UPDATE cs_survey_templates SET is_system = true WHERE division IN ('classroom', 'remote', 'content_dev', 'smart', 'hrm', 'hr_consulting');

-- division UNIQUE 제약 제거 (사용자가 같은 division으로 복제 가능하도록)
ALTER TABLE cs_survey_templates DROP CONSTRAINT IF EXISTS cs_survey_templates_division_key;
