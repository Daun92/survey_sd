-- ============================================
-- 008: 사용자 역할 테이블 및 RBAC 기반
-- ============================================

-- Phase 1 MVP 역할: admin, creator, viewer
-- Phase 2에서 manager, im, cs, am, consulting, marketing 추가 예정

CREATE TYPE app_role AS ENUM ('admin', 'creator', 'viewer');

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 자신의 역할을 조회 가능
CREATE POLICY "users_read_own_role" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- admin만 역할 관리 가능
CREATE POLICY "admins_manage_roles" ON user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- 인덱스
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- ============================================
-- 앱 설정 테이블 (Gemini API key 등)
-- 기존 코드에서 app_settings를 참조하지만 테이블이 없을 수 있음
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_users_manage_settings" ON app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
