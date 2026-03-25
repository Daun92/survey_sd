import { createClient } from "@supabase/supabase-js";

// 서비스 역할 클라이언트 — RLS를 우회합니다
// 서버사이드에서만 사용 (크론잡, 이메일 배포, 관리 작업 등)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
