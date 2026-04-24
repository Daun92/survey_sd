import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// TODO(types): createServerClient<Database>() 로 점진 이행. 개별 쿼리 타입
// 불일치 정리 후 적용. (PR 4 에선 src/types/supabase.ts 생성·파이프라인만)

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll은 Server Component에서 호출될 수 있음
            // 미들웨어에서 세션 갱신을 처리하므로 무시 가능
          }
        },
      },
    }
  );
}
