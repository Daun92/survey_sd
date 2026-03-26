-- =============================================
-- 005: CS 만족도 설문 문항 템플릿 테이블 및 시드 데이터
-- 기존 research.exc.co.kr 6개 부문 설문 기반
-- =============================================

-- 1. CS 설문 템플릿 테이블
CREATE TABLE IF NOT EXISTS cs_survey_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  division TEXT NOT NULL,                          -- 부문: classroom, remote, content_dev, smart, hrm, hr_consulting
  division_label TEXT NOT NULL,                    -- 한글명: 집체, 원격, 콘텐츠개발, 스마트훈련, HRM채용대행, HR컨설팅
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(division)
);

-- 2. CS 설문 문항 테이블
CREATE TABLE IF NOT EXISTS cs_survey_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES cs_survey_templates(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL DEFAULT '1P',            -- 1P, 2P, eco
  question_no TEXT NOT NULL,                       -- 설문 문항번호: Q1, Q7-1, 에코Q1 등
  result_column TEXT NOT NULL,                     -- 결과페이지 컬럼명: q1, q7_1, 에코1번 등
  question_text TEXT NOT NULL,                     -- 문항 내용
  question_type TEXT NOT NULL DEFAULT 'likert_5',  -- likert_5, likert_6, single_choice, text, likert_5_na
  response_options TEXT,                           -- 응답 선택지 설명
  section_label TEXT,                              -- 섹션 라벨: [담당자], [강사], [서비스], [과정/시스템] 등
  mapping_status TEXT DEFAULT 'matched',           -- matched, mismatched, unknown
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,                                      -- 비고/주의사항
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CS 설문 주의사항 테이블
CREATE TABLE IF NOT EXISTS cs_survey_warnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES cs_survey_templates(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL,                      -- data_order, numbering_mismatch, unknown_column, column_naming, respondent_structure
  description TEXT NOT NULL,
  affected_questions TEXT,                         -- 영향 받는 설문 번호 범위
  affected_columns TEXT,                           -- 영향 받는 결과 컬럼
  action_required TEXT NOT NULL,                   -- 조치사항
  severity TEXT DEFAULT 'warning',                 -- info, warning, critical
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_cs_questions_template ON cs_survey_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_cs_questions_page ON cs_survey_questions(template_id, page_type);
CREATE INDEX IF NOT EXISTS idx_cs_warnings_template ON cs_survey_warnings(template_id);

-- RLS 정책: anon 역할 읽기 허용
ALTER TABLE cs_survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_survey_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read cs_survey_templates" ON cs_survey_templates FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read cs_survey_questions" ON cs_survey_questions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read cs_survey_warnings" ON cs_survey_warnings FOR SELECT TO anon USING (true);
