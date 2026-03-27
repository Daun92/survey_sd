-- ============================================
-- 015: edu_surveys에 owner_id 추가 (설문 생성자 추적)
-- ============================================

ALTER TABLE edu_surveys ADD COLUMN owner_id UUID REFERENCES auth.users(id);
