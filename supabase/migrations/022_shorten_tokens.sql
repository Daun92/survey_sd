-- 토큰 길이 단축: 32자 hex → 12자 hex (gen_random_bytes 16 → 6)
-- 기존 데이터는 변경하지 않으며, 신규 생성분부터 적용됨

ALTER TABLE edu_surveys
  ALTER COLUMN url_token SET DEFAULT encode(gen_random_bytes(6), 'hex');

ALTER TABLE distributions
  ALTER COLUMN unique_token SET DEFAULT encode(gen_random_bytes(6), 'hex');
