-- ============================================
-- 017: distributions 테이블에 수신자 상세 정보 컬럼 추가
-- ============================================
-- 회사, 부서, 직책, 연락처를 개별 배부 레코드에 직접 저장

ALTER TABLE distributions
  ADD COLUMN IF NOT EXISTS recipient_company VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recipient_department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recipient_position VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(30);
