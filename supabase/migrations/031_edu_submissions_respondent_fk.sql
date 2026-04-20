-- =============================================
-- 031: edu_submissions 에 respondent_id FK 추가
--
-- 목적:
--   응답(edu_submissions) 과 주소록(respondents) 을 연결해 같은 응답자의
--   시계열 응답 이력을 추적할 수 있게 한다.
--   - 개인 링크(distributions.unique_token) 경로는 submit 시 distribution.respondent_id
--     를 그대로 복사한다 (API 로직으로 처리).
--   - 공통 링크(/s/<token>) 경로는 respondent_id 불명이므로 NULL 유지.
--     추후 email/phone 기반 fuzzy 매칭으로 소급 연결 가능.
--
-- 이 마이그레이션은 idempotent 하며, 과거 제출분에 대해서는 distribution_id 를
-- 경유해 소급 매칭을 수행한다.
-- =============================================

-- 1. 컬럼 추가 (ON DELETE SET NULL — 주소록 삭제 시 응답 이력 자체는 보존)
ALTER TABLE edu_submissions
  ADD COLUMN IF NOT EXISTS respondent_id UUID
    REFERENCES respondents(id) ON DELETE SET NULL;

COMMENT ON COLUMN edu_submissions.respondent_id IS
  '응답자(주소록 FK). 개인 링크 경로는 distribution.respondent_id 복사, 공통 링크는 NULL.';

-- 2. 인덱스 (응답자별 이력 조회 쿼리 속도 확보)
CREATE INDEX IF NOT EXISTS idx_edu_submissions_respondent
  ON edu_submissions(respondent_id)
  WHERE respondent_id IS NOT NULL;

-- 3. 과거 제출분 소급 매칭
--    distribution_id 가 설정되어 있고, 해당 distribution 에 respondent_id 가 있으면 그대로 복사.
--    (ON DELETE SET NULL 으로 두었으므로 후속 respondents 삭제도 안전)
UPDATE edu_submissions AS s
   SET respondent_id = d.respondent_id
  FROM distributions AS d
 WHERE s.distribution_id = d.id
   AND d.respondent_id IS NOT NULL
   AND s.respondent_id IS NULL;
