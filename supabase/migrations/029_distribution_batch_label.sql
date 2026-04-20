-- ============================================
-- 029. 배치 라벨 (차수 커스텀 이름)
-- ============================================
-- 차수 번호는 created_at 순서대로 클라이언트에서 자동 계산하되,
-- 사용자가 특정 배치에 "상반기", "마감 직전 발송" 같은 커스텀 라벨을
-- 부여하고 싶을 때 우선 표시되도록 label 컬럼을 추가한다.
--
-- label 이 NULL 이면 UI 는 자동 번호("1차", "2차")를 표시.
-- label 이 있으면 그 텍스트를 표시.
-- 고유성 강제 안 함 — 같은 설문에 중복 라벨 허용.

ALTER TABLE distribution_batches
  ADD COLUMN IF NOT EXISTS label TEXT;

COMMENT ON COLUMN distribution_batches.label IS
  '사용자 지정 배치 라벨. NULL 이면 UI 에서 차수 번호(1차, 2차...)를 자동 표시.';
