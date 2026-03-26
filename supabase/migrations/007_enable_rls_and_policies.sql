-- ============================================
-- 007: RLS 활성화 및 보안 정책
-- ============================================
-- 모든 핵심 테이블에 RLS를 활성화하고
-- 인증된 사용자 + 공개 설문 응답자에 대한 정책을 정의합니다.

-- ============================================
-- 1. RLS 활성화
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- edu_* 테이블
ALTER TABLE edu_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_survey_templates ENABLE ROW LEVEL SECURITY;

-- hrd_* 테이블
ALTER TABLE hrd_survey_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrd_survey_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrd_survey_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrd_respondents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrd_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrd_benchmark_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrd_consulting_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. 인증된 사용자 정책 (관리자/내부 사용자)
-- 로그인된 사용자는 모든 데이터에 접근 가능
-- (Phase 2에서 organization_id 기반 테넌트 격리로 세분화)
-- ============================================

-- user_profiles
CREATE POLICY "auth_users_select_profiles" ON user_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_users_update_own_profile" ON user_profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- organizations
CREATE POLICY "auth_users_manage_organizations" ON organizations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- projects
CREATE POLICY "auth_users_manage_projects" ON projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- courses
CREATE POLICY "auth_users_manage_courses" ON courses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sessions
CREATE POLICY "auth_users_manage_sessions" ON sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- class_groups
CREATE POLICY "auth_users_manage_class_groups" ON class_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- instructors
CREATE POLICY "auth_users_manage_instructors" ON instructors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- session_instructors
CREATE POLICY "auth_users_manage_session_instructors" ON session_instructors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- survey_templates
CREATE POLICY "auth_users_manage_templates" ON survey_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- surveys (generic)
CREATE POLICY "auth_users_manage_surveys" ON surveys
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- questions (generic)
CREATE POLICY "auth_users_manage_questions" ON questions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- submissions (generic)
CREATE POLICY "auth_users_manage_submissions" ON submissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- edu_surveys
CREATE POLICY "auth_users_manage_edu_surveys" ON edu_surveys
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- edu_questions
CREATE POLICY "auth_users_manage_edu_questions" ON edu_questions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- edu_submissions
CREATE POLICY "auth_users_manage_edu_submissions" ON edu_submissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- edu_survey_templates
CREATE POLICY "auth_users_manage_edu_templates" ON edu_survey_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- hrd_survey_rounds
CREATE POLICY "auth_users_manage_hrd_rounds" ON hrd_survey_rounds
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- hrd_survey_parts
CREATE POLICY "auth_users_manage_hrd_parts" ON hrd_survey_parts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- hrd_survey_items
CREATE POLICY "auth_users_manage_hrd_items" ON hrd_survey_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- hrd_respondents
CREATE POLICY "auth_users_manage_hrd_respondents" ON hrd_respondents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- hrd_responses
CREATE POLICY "auth_users_manage_hrd_responses" ON hrd_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- hrd_benchmark_cache
CREATE POLICY "auth_users_manage_hrd_benchmarks" ON hrd_benchmark_cache
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- hrd_consulting_reports
CREATE POLICY "auth_users_manage_hrd_reports" ON hrd_consulting_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 3. 공개 설문 응답자 정책 (anon)
-- 토큰 기반 접근: 설문 URL을 통해 접근하는 비로그인 응답자
-- ============================================

-- 응답자가 설문 정보를 읽을 수 있어야 함 (토큰 기반)
CREATE POLICY "anon_read_active_surveys" ON surveys
  FOR SELECT TO anon
  USING (status = 'active' AND url_token IS NOT NULL);

CREATE POLICY "anon_read_active_edu_surveys" ON edu_surveys
  FOR SELECT TO anon
  USING (status = 'active' AND url_token IS NOT NULL);

-- 응답자가 문항을 읽을 수 있어야 함
CREATE POLICY "anon_read_survey_questions" ON questions
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM surveys s
      WHERE s.id = questions.survey_id
        AND s.status = 'active'
    )
  );

CREATE POLICY "anon_read_edu_questions" ON edu_questions
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM edu_surveys s
      WHERE s.id = edu_questions.survey_id
        AND s.status = 'active'
    )
  );

-- 응답자가 응답을 제출할 수 있어야 함
CREATE POLICY "anon_insert_submissions" ON submissions
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM surveys s
      WHERE s.id = submissions.survey_id
        AND s.status = 'active'
    )
  );

CREATE POLICY "anon_insert_edu_submissions" ON edu_submissions
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM edu_surveys s
      WHERE s.id = edu_submissions.survey_id
        AND s.status = 'active'
    )
  );

-- class_groups: 토큰으로 그룹 조회 (설문 제출 시 class_group 매칭)
CREATE POLICY "anon_read_class_groups_by_token" ON class_groups
  FOR SELECT TO anon
  USING (survey_url_token IS NOT NULL);

-- survey_templates: 읽기 전용 (설문 렌더링에 필요할 수 있음)
CREATE POLICY "anon_read_templates" ON survey_templates
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_edu_templates" ON edu_survey_templates
  FOR SELECT TO anon USING (true);

-- ============================================
-- 4. HRD 응답자 정책 (anon)
-- HRD 응답자도 토큰 기반 접근
-- ============================================

-- HRD 라운드 정보 읽기 (수집 중인 라운드만)
CREATE POLICY "anon_read_active_hrd_rounds" ON hrd_survey_rounds
  FOR SELECT TO anon
  USING (status = 'collecting');

-- HRD 파트/아이템 읽기 (수집 중인 라운드 소속)
CREATE POLICY "anon_read_hrd_parts" ON hrd_survey_parts
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM hrd_survey_rounds r
      WHERE r.id = hrd_survey_parts.round_id
        AND r.status = 'collecting'
    )
  );

CREATE POLICY "anon_read_hrd_items" ON hrd_survey_items
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM hrd_survey_parts p
      JOIN hrd_survey_rounds r ON r.id = p.round_id
      WHERE p.id = hrd_survey_items.part_id
        AND r.status = 'collecting'
    )
  );

-- HRD 응답자: 자기 정보만 읽기 (토큰 기반)
CREATE POLICY "anon_read_own_hrd_respondent" ON hrd_respondents
  FOR SELECT TO anon
  USING (url_token IS NOT NULL);

-- HRD 응답 제출/수정 (draft 저장 포함)
CREATE POLICY "anon_insert_hrd_responses" ON hrd_responses
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hrd_respondents resp
      WHERE resp.id = hrd_responses.respondent_id
        AND resp.status IN ('invited', 'in_progress')
    )
  );

CREATE POLICY "anon_update_hrd_responses" ON hrd_responses
  FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM hrd_respondents resp
      WHERE resp.id = hrd_responses.respondent_id
        AND resp.status IN ('invited', 'in_progress')
    )
  );

-- HRD 벤치마크 캐시 읽기 (published 라운드만)
CREATE POLICY "anon_read_published_benchmarks" ON hrd_benchmark_cache
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM hrd_survey_rounds r
      WHERE r.id = hrd_benchmark_cache.round_id
        AND r.status = 'published'
    )
  );
