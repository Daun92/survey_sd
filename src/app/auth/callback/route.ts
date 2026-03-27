import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/admin";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 첫 로그인 감지: user_roles 레코드가 없으면 계정 설정으로 안내
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: role } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!role) {
          // 첫 로그인 — 비밀번호 및 프로필 설정 안내
          return NextResponse.redirect(
            `${origin}/admin/account?setup=true`
          );
        }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // 에러 시 로그인 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
