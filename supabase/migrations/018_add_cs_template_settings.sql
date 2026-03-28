-- CS 템플릿에 settings JSONB 컬럼 추가 (히어로/엔딩/섹션 인트로/응답자 필드 등)
ALTER TABLE cs_survey_templates ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
