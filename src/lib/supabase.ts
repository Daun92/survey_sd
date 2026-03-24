import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 클라이언트 사이드용 Supabase 클라이언트
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버 사이드용 Supabase 클라이언트 (service role key 사용)
export function createServerSupabaseClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
