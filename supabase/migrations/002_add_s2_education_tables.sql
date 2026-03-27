-- ============================================
-- EXC-Survey: S2 교육과정 만족도 확장 마이그레이션
-- 기존 테이블(customers, surveys, survey_questions 등) 보존
-- 신규 테이블만 추가
-- ============================================

-- Enable UUID extension (if not exists)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 프로젝트 (수주 단위)
-- customers 테이블의 고객사를 FK로 참조
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id INTEGER REFERENCES customers(id),  -- 기존 customers 테이블 참조
  name VARCHAR(300) NOT NULL,
  bris_code VARCHAR(50),
  project_type VARCHAR(50) DEFAULT 'education',
  status VARCHAR(30) DEFAULT 'active',
  am_name VARCHAR(100),         -- 담당 AM (user_profiles 미구축 전 임시)
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 교육과정 (프로젝트 하위)
-- ============================================
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  education_type VARCHAR(30) DEFAULT 'classroom',
  description TEXT,
  target_audience TEXT,
  total_hours DECIMAL(5,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 차수 (과정별 회차)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  name VARCHAR(300),
  location VARCHAR(200),
  region VARCHAR(50),
  start_date DATE,
  end_date DATE,
  total_hours DECIMAL(5,1),
  capacity INTEGER DEFAULT 0,
  im_name VARCHAR(100),         -- 담당 IM (user_profiles 미구축 전 임시)
  status VARCHAR(30) DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 분반 (차수 하위, QR/URL 설문 룸)
-- ============================================
CREATE TABLE IF NOT EXISTS class_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  survey_url_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  capacity INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. 강사
-- ============================================
CREATE TABLE IF NOT EXISTS instructors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  specialty TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 차수-강사 매핑 (M:N)
CREATE TABLE IF NOT EXISTS session_instructors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id),
  module_name VARCHAR(200),
  UNIQUE(session_id, instructor_id, module_name)
);

-- ============================================
-- 6. 교육 설문 (S2용, 기존 surveys와 별도)
-- ============================================
CREATE TABLE IF NOT EXISTS edu_surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  survey_type VARCHAR(20) NOT NULL DEFAULT 's2_edu_post',
  education_type VARCHAR(30) DEFAULT 'classroom',
  status VARCHAR(30) DEFAULT 'draft',
  url_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  settings JSONB DEFAULT '{}',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. 교육 설문 문항
-- ============================================
CREATE TABLE IF NOT EXISTS edu_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES edu_surveys(id) ON DELETE CASCADE,
  section VARCHAR(100),
  question_code VARCHAR(30),
  question_text TEXT NOT NULL,
  question_type VARCHAR(30) NOT NULL DEFAULT 'likert_5',
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  options JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. 교육 설문 응답
-- ============================================
CREATE TABLE IF NOT EXISTS edu_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES edu_surveys(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id),
  class_group_id UUID REFERENCES class_groups(id),
  respondent_name VARCHAR(100),
  respondent_department VARCHAR(100),
  respondent_position VARCHAR(100),
  answers JSONB NOT NULL DEFAULT '{}',
  channel VARCHAR(20) DEFAULT 'online',
  is_complete BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. 설문 템플릿 (교육유형별)
-- ============================================
CREATE TABLE IF NOT EXISTS edu_survey_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_type VARCHAR(20) NOT NULL,
  education_type VARCHAR(30) DEFAULT 'classroom',
  name VARCHAR(200) NOT NULL,
  description TEXT,
  question_config JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(survey_type, education_type)
);

-- ============================================
-- 10. 인덱스
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_courses_project ON courses(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_class_groups_session ON class_groups(session_id);
CREATE INDEX IF NOT EXISTS idx_edu_surveys_session ON edu_surveys(session_id);
CREATE INDEX IF NOT EXISTS idx_edu_surveys_project ON edu_surveys(project_id);
CREATE INDEX IF NOT EXISTS idx_edu_surveys_url_token ON edu_surveys(url_token);
CREATE INDEX IF NOT EXISTS idx_edu_questions_survey ON edu_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_edu_questions_sort ON edu_questions(survey_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_edu_submissions_survey ON edu_submissions(survey_id);
CREATE INDEX IF NOT EXISTS idx_edu_submissions_session ON edu_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_edu_submissions_class_group ON edu_submissions(class_group_id);
CREATE INDEX IF NOT EXISTS idx_edu_submissions_answers ON edu_submissions USING GIN(answers);

-- ============================================
-- 11. 뷰: 차수별 교육 설문 응답 통계
-- ============================================
CREATE OR REPLACE VIEW v_edu_survey_stats AS
SELECT
  s.id AS survey_id,
  s.title,
  s.session_id,
  sess.name AS session_name,
  sess.capacity,
  COUNT(sub.id) AS response_count,
  COUNT(CASE WHEN sub.is_complete THEN 1 END) AS complete_count,
  CASE WHEN sess.capacity > 0
    THEN ROUND(COUNT(sub.id)::DECIMAL / sess.capacity * 100, 1)
    ELSE 0
  END AS response_rate
FROM edu_surveys s
LEFT JOIN sessions sess ON s.session_id = sess.id
LEFT JOIN edu_submissions sub ON s.id = sub.survey_id
GROUP BY s.id, s.title, s.session_id, sess.name, sess.capacity;
