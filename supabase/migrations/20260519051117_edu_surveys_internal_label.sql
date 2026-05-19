-- 설문 표시명 분리: edu_surveys.internal_label 추가.
--
-- 배경: title 한 컬럼에 공개용 공식 명칭과 운영용 표기("집체/5월/1차" 등)가
-- 섞여 들어와, 응답자 화면에 운영 표기가 노출되는 문제가 있었음.
-- 본 컬럼 추가로 title 의 의미를 "공개용 공식 명칭" 으로 고정하고,
-- 운영용 자유 라벨은 internal_label 에 분리 저장.
--
-- 표기 규약 (B+C 하이브리드):
--   - 응답자 화면: title 만
--   - 관리자 화면: title + (internal_label 이 있으면 그것 / 없으면 session·
--     course 메타 자동 조합) — 자동 조합은 코드 헬퍼 composeSurveySubtitle 가 담당.
--
-- 기존 32 행은 NULL 유지. 새 설문부터 자유 입력. 일괄 정리는 별건.

ALTER TABLE edu_surveys
  ADD COLUMN IF NOT EXISTS internal_label text;

COMMENT ON COLUMN edu_surveys.internal_label IS
  '관리자 화면용 자유 라벨 (예: 집체/5월/1차). NULL 이면 session·course 메타로 자동 조합 표기. 응답자 화면에는 노출되지 않음.';
