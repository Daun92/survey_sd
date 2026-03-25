import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "creator" | "viewer";

/**
 * 현재 로그인한 사용자 정보를 가져옵니다.
 * 인증되지 않은 경우 로그인 페이지로 리다이렉트합니다.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * 현재 사용자의 역할을 가져옵니다.
 * user_roles 테이블에 레코드가 없으면 'viewer'를 기본값으로 반환합니다.
 */
export async function getUserRole(): Promise<AppRole> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return (data?.role as AppRole) || "viewer";
}

/**
 * 특정 역할 이상인지 확인합니다.
 * admin > creator > viewer
 */
export async function requireRole(minRole: AppRole) {
  const role = await getUserRole();

  const hierarchy: Record<AppRole, number> = {
    admin: 3,
    creator: 2,
    viewer: 1,
  };

  if (hierarchy[role] < hierarchy[minRole]) {
    redirect("/admin?error=unauthorized");
  }

  return role;
}
