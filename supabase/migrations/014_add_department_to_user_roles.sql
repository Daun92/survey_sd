-- ============================================
-- 014: 부서(department) 컬럼 추가
-- ============================================

CREATE TYPE app_department AS ENUM ('im', 'am', 'sales', 'marketing', 'consulting');

ALTER TABLE user_roles
  ADD COLUMN department app_department,
  ADD COLUMN display_name VARCHAR(100);
