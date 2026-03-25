import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 레거시 호환 클라이언트 — 점진적으로 server/client 클라이언트로 교체 예정
// 서버 컴포넌트/액션: import { createClient } from "@/lib/supabase/server"
// 클라이언트 컴포넌트: import { createClient } from "@/lib/supabase/client"
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
