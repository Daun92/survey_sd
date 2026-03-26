import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "creator" | "viewer";
export type AppDepartment = "im" | "am" | "sales" | "marketing" | "consulting";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  department: AppDepartment | null;
}

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
 * 인증 + 역할 + 부서를 한번에 가져옵니다.
 * user_roles 레코드가 없으면 viewer/부서없음 기본값.
 */
export async function getUserProfile(): Promise<UserProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS 우회: security definer 함수로 역할 조회
  const { data, error } = await supabase
    .rpc("get_user_role", { p_user_id: user.id })
    .single<{ role: string; department: string | null; display_name: string | null }>();

  if (error) {
    console.error("[auth] get_user_role RPC 실패:", error.message, "user:", user.id);
  }

  return {
    id: user.id,
    email: user.email || "",
    displayName: data?.display_name || user.email?.split("@")[0] || "",
    role: (data?.role as AppRole) || "viewer",
    department: (data?.department as AppDepartment) || null,
  };
}

/**
 * 현재 사용자의 역할을 가져옵니다.
 */
export async function getUserRole(): Promise<AppRole> {
  const profile = await getUserProfile();
  return profile.role;
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

/** HRD 섹션 접근 가능 여부 (admin 또는 마케팅 부서) */
export function canAccessHrd(profile: UserProfile): boolean {
  return profile.role === "admin" || profile.department === "marketing";
}

/** 설정 페이지 접근 가능 여부 (admin만) */
export function canAccessSettings(profile: UserProfile): boolean {
  return profile.role === "admin";
}
