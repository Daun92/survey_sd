-- ============================================
-- 016: 사용자 자기 프로필 관리 RLS 정책
-- - 자기 display_name 업데이트 허용
-- - 첫 로그인 시 user_roles 자동 생성 허용
-- ============================================

-- 사용자가 자기 레코드를 업데이트할 수 있도록 허용
-- (서버 액션에서 display_name만 업데이트하도록 코드 레벨 제한)
CREATE POLICY "users_update_own_role" ON user_roles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 첫 로그인 시 자기 user_roles 레코드를 생성할 수 있도록 허용
CREATE POLICY "users_insert_own_role" ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
