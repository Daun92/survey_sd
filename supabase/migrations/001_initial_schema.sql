-- EXC-Survey Platform Schema
-- Phase 1 MVP: S2 교육과정 만족도 중심

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 사용자/계정 관리
-- ============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'viewer',
  -- roles: admin, manager, im, cs, am, consulting, marketing, viewer
  team VARCHAR(100),
  department VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 고객사
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  industry VARCHAR(100),
  size VARCHAR(50), -- large, medium, small, public
  bris_code VARCHAR(50),
  contact_name VARCHAR(100),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 프로젝트
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(300) NOT NULL,
  bris_code VARCHAR(50),
  project_type VARCHAR(50) DEFAULT 'education',
  -- education, consulting, recruitment
  status VARCHAR(30) DEFAULT 'active',
  -- draft, active, completed, archived
  am_id UUID REFERENCES user_profiles(id),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 교육과정
-- ============================================
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  education_type VARCHAR(30) DEFAULT 'classroom',
  -- classroom(집체), remote(원격), consulting(컨설팅), recruitment(채용), public(공공)
  description TEXT,
  target_audience TEXT,
  total_hours DECIMAL(5,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. 차수 (Sessions)
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  name VARCHAR(300), -- e.g., "서울 3차", "부산 5차"
  location VARCHAR(200),
  region VARCHAR(50), -- 서울, 부산, etc.
  start_date DATE,
  end_date DATE,
  total_hours DECIMAL(5,1),
  capacity INTEGER,
  im_id UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'scheduled',
  -- scheduled, in_progress, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. 분반 (Class Groups)
-- ============================================
CREATE TABLE class_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "1분반", "A반"
  survey_url_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  capacity INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. 강사
-- ============================================
CREATE TABLE instructors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  specialty TEXT,
  email VARCHAR(255),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 차수-강사 매핑 (M:N)
CREATE TABLE session_instructors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id),
  module_name VARCHAR(200), -- 담당 모듈명
  UNIQUE(session_id, instructor_id, module_name)
);

-- ============================================
-- 8. 설문 템플릿
-- ============================================
CREATE TABLE survey_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_type VARCHAR(20) NOT NULL,
  -- s1_cs, s2_edu_post, s3_instructor, s4_needs, s4b_pre, s5_internal, s7_market
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
-- 9. 설문
-- ============================================
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES survey_templates(id),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  survey_type VARCHAR(20) NOT NULL,
  education_type VARCHAR(30) DEFAULT 'classroom',
  status VARCHAR(30) DEFAULT 'draft',
  -- draft, active, paused, closed, archived
  url_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  settings JSONB DEFAULT '{}',
  -- { anonymous: true, allow_edit: false, collect_respondent_info: true, ... }
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. 문항
-- ============================================
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  section VARCHAR(100), -- 영역: 교육내용, 모듈만족도, 강사만족도, 교육운영, 교육성과, 과정전반, 서술형
  question_code VARCHAR(30), -- Q1-1, Q2-1, etc.
  question_text TEXT NOT NULL,
  question_type VARCHAR(30) NOT NULL DEFAULT 'likert_5',
  -- likert_5, likert_7, single_choice, multiple_choice, text, number, rating
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  options JSONB, -- for choice questions: [{"value": 1, "label": "매우 불만족"}, ...]
  metadata JSONB DEFAULT '{}',
  -- { module_code: "M1", instructor_ref: true, ... }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. 응답
-- ============================================
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id),
  class_group_id UUID REFERENCES class_groups(id),
  respondent_name VARCHAR(100),
  respondent_department VARCHAR(100),
  respondent_position VARCHAR(100),
  respondent_email VARCHAR(255),
  answers JSONB NOT NULL DEFAULT '{}',
  -- { "Q1-1": 5, "Q1-2": 4, "Q2-1": 5, "open_1": "좋았습니다", ... }
  channel VARCHAR(20) DEFAULT 'online',
  -- online, phone, paper
  is_complete BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. 인덱스
-- ============================================
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_courses_project ON courses(project_id);
CREATE INDEX idx_sessions_course ON sessions(course_id);
CREATE INDEX idx_class_groups_session ON class_groups(session_id);
CREATE INDEX idx_surveys_session ON surveys(session_id);
CREATE INDEX idx_surveys_project ON surveys(project_id);
CREATE INDEX idx_surveys_url_token ON surveys(url_token);
CREATE INDEX idx_questions_survey ON questions(survey_id);
CREATE INDEX idx_questions_sort ON questions(survey_id, sort_order);
CREATE INDEX idx_submissions_survey ON submissions(survey_id);
CREATE INDEX idx_submissions_session ON submissions(session_id);
CREATE INDEX idx_submissions_class_group ON submissions(class_group_id);
CREATE INDEX idx_submissions_answers ON submissions USING GIN(answers);

-- ============================================
-- 13. 뷰: 차수별 응답 통계
-- ============================================
CREATE OR REPLACE VIEW v_session_survey_stats AS
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
FROM surveys s
LEFT JOIN sessions sess ON s.session_id = sess.id
LEFT JOIN submissions sub ON s.id = sub.survey_id
GROUP BY s.id, s.title, s.session_id, sess.name, sess.capacity;
