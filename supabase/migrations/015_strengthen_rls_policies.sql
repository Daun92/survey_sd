-- ============================================
-- 015: RLS 정책 강화
-- - app_settings 테이블 RLS 추가
-- - viewer 역할 쓰기 제한
-- - HRD 테이블 부서 기반 쓰기 제한
-- ============================================

-- ============================================
-- 헬퍼 함수: 현재 사용자 역할 조회
-- ============================================
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid()),
    'viewer'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_department()
RETURNS TEXT AS $$
  SELECT department FROM public.user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 역할 계층 비교 함수: 주어진 역할 이상인지 확인
CREATE OR REPLACE FUNCTION auth.has_min_role(min_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT CASE auth.user_role()
    WHEN 'admin' THEN true
    WHEN 'creator' THEN min_role IN ('creator', 'viewer')
    WHEN 'viewer' THEN min_role = 'viewer'
    ELSE false
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 1. app_settings 테이블 RLS
-- ============================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 읽기: 모든 인증 사용자 (AI 기능에서 API 키 조회 필요)
CREATE POLICY "auth_users_read_settings" ON app_settings
  FOR SELECT TO authenticated USING (true);

-- 쓰기: admin만
CREATE POLICY "admin_manage_settings" ON app_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.user_role() = 'admin');

CREATE POLICY "admin_update_settings" ON app_settings
  FOR UPDATE TO authenticated
  USING (auth.user_role() = 'admin');

CREATE POLICY "admin_delete_settings" ON app_settings
  FOR DELETE TO authenticated
  USING (auth.user_role() = 'admin');

-- ============================================
-- 2. 핵심 테이블: viewer는 읽기만 가능
-- 기존 FOR ALL 정책을 DROP 후 SELECT + 쓰기 분리
-- ============================================

-- == edu_surveys ==
DROP POLICY IF EXISTS "auth_users_manage_edu_surveys" ON edu_surveys;
CREATE POLICY "auth_users_read_edu_surveys" ON edu_surveys
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_creators_write_edu_surveys" ON edu_surveys
  FOR INSERT TO authenticated
  WITH CHECK (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_update_edu_surveys" ON edu_surveys
  FOR UPDATE TO authenticated
  USING (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_delete_edu_surveys" ON edu_surveys
  FOR DELETE TO authenticated
  USING (auth.has_min_role('creator'));

-- == edu_questions ==
DROP POLICY IF EXISTS "auth_users_manage_edu_questions" ON edu_questions;
CREATE POLICY "auth_users_read_edu_questions" ON edu_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_creators_write_edu_questions" ON edu_questions
  FOR INSERT TO authenticated
  WITH CHECK (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_update_edu_questions" ON edu_questions
  FOR UPDATE TO authenticated
  USING (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_delete_edu_questions" ON edu_questions
  FOR DELETE TO authenticated
  USING (auth.has_min_role('creator'));

-- == edu_survey_templates ==
DROP POLICY IF EXISTS "auth_users_manage_edu_templates" ON edu_survey_templates;
CREATE POLICY "auth_users_read_edu_templates" ON edu_survey_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_creators_write_edu_templates" ON edu_survey_templates
  FOR INSERT TO authenticated
  WITH CHECK (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_update_edu_templates" ON edu_survey_templates
  FOR UPDATE TO authenticated
  USING (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_delete_edu_templates" ON edu_survey_templates
  FOR DELETE TO authenticated
  USING (auth.has_min_role('creator'));

-- == organizations ==
DROP POLICY IF EXISTS "auth_users_manage_organizations" ON organizations;
CREATE POLICY "auth_users_read_organizations" ON organizations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_creators_write_organizations" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_update_organizations" ON organizations
  FOR UPDATE TO authenticated
  USING (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_delete_organizations" ON organizations
  FOR DELETE TO authenticated
  USING (auth.has_min_role('creator'));

-- == projects ==
DROP POLICY IF EXISTS "auth_users_manage_projects" ON projects;
CREATE POLICY "auth_users_read_projects" ON projects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_creators_write_projects" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_update_projects" ON projects
  FOR UPDATE TO authenticated
  USING (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_delete_projects" ON projects
  FOR DELETE TO authenticated
  USING (auth.has_min_role('creator'));

-- == courses ==
DROP POLICY IF EXISTS "auth_users_manage_courses" ON courses;
CREATE POLICY "auth_users_read_courses" ON courses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_creators_write_courses" ON courses
  FOR INSERT TO authenticated
  WITH CHECK (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_update_courses" ON courses
  FOR UPDATE TO authenticated
  USING (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_delete_courses" ON courses
  FOR DELETE TO authenticated
  USING (auth.has_min_role('creator'));

-- == sessions ==
DROP POLICY IF EXISTS "auth_users_manage_sessions" ON sessions;
CREATE POLICY "auth_users_read_sessions" ON sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_creators_write_sessions" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_update_sessions" ON sessions
  FOR UPDATE TO authenticated
  USING (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_delete_sessions" ON sessions
  FOR DELETE TO authenticated
  USING (auth.has_min_role('creator'));

-- == class_groups ==
DROP POLICY IF EXISTS "auth_users_manage_class_groups" ON class_groups;
CREATE POLICY "auth_users_read_class_groups" ON class_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_creators_write_class_groups" ON class_groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_update_class_groups" ON class_groups
  FOR UPDATE TO authenticated
  USING (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_delete_class_groups" ON class_groups
  FOR DELETE TO authenticated
  USING (auth.has_min_role('creator'));

-- == instructors ==
DROP POLICY IF EXISTS "auth_users_manage_instructors" ON instructors;
CREATE POLICY "auth_users_read_instructors" ON instructors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_creators_write_instructors" ON instructors
  FOR INSERT TO authenticated
  WITH CHECK (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_update_instructors" ON instructors
  FOR UPDATE TO authenticated
  USING (auth.has_min_role('creator'));
CREATE POLICY "auth_creators_delete_instructors" ON instructors
  FOR DELETE TO authenticated
  USING (auth.has_min_role('creator'));

-- ============================================
-- 3. HRD 테이블: admin 또는 marketing 부서만 쓰기
-- ============================================

DROP POLICY IF EXISTS "auth_users_manage_hrd_rounds" ON hrd_survey_rounds;
CREATE POLICY "auth_users_read_hrd_rounds" ON hrd_survey_rounds
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_hrd_write_rounds" ON hrd_survey_rounds
  FOR INSERT TO authenticated
  WITH CHECK (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_update_rounds" ON hrd_survey_rounds
  FOR UPDATE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_delete_rounds" ON hrd_survey_rounds
  FOR DELETE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');

DROP POLICY IF EXISTS "auth_users_manage_hrd_parts" ON hrd_survey_parts;
CREATE POLICY "auth_users_read_hrd_parts" ON hrd_survey_parts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_hrd_write_parts" ON hrd_survey_parts
  FOR INSERT TO authenticated
  WITH CHECK (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_update_parts" ON hrd_survey_parts
  FOR UPDATE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_delete_parts" ON hrd_survey_parts
  FOR DELETE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');

DROP POLICY IF EXISTS "auth_users_manage_hrd_items" ON hrd_survey_items;
CREATE POLICY "auth_users_read_hrd_items" ON hrd_survey_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_hrd_write_items" ON hrd_survey_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_update_items" ON hrd_survey_items
  FOR UPDATE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_delete_items" ON hrd_survey_items
  FOR DELETE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');

DROP POLICY IF EXISTS "auth_users_manage_hrd_respondents" ON hrd_respondents;
CREATE POLICY "auth_users_read_hrd_respondents" ON hrd_respondents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_hrd_write_respondents" ON hrd_respondents
  FOR INSERT TO authenticated
  WITH CHECK (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_update_respondents" ON hrd_respondents
  FOR UPDATE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_delete_respondents" ON hrd_respondents
  FOR DELETE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');

DROP POLICY IF EXISTS "auth_users_manage_hrd_reports" ON hrd_consulting_reports;
CREATE POLICY "auth_users_read_hrd_reports" ON hrd_consulting_reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_hrd_write_reports" ON hrd_consulting_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_update_reports" ON hrd_consulting_reports
  FOR UPDATE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
CREATE POLICY "auth_hrd_delete_reports" ON hrd_consulting_reports
  FOR DELETE TO authenticated
  USING (auth.user_role() = 'admin' OR auth.user_department() = 'marketing');
