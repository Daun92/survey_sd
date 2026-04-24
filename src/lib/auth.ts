import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
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
 *
 * React cache(): 동일 요청 내 Supabase auth.getUser() 중복 왕복 제거.
 */
export const requireAuth = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});

/**
 * 인증 + 역할 + 부서를 한번에 가져옵니다.
 * user_roles 레코드가 없으면 viewer/부서없음 기본값.
 *
 * React cache(): admin layout + hrd layout 등 같은 요청 내 중복 호출에서
 * auth.getUser() + get_user_role RPC 왕복을 1회로 단축.
 */
export const getUserProfile = cache(async (): Promise<UserProfile> => {
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
});

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

// ============================================
// API Route용 인증 헬퍼
// Server Component의 redirect 대신 JSON 응답 반환
// ============================================

const ROLE_HIERARCHY: Record<AppRole, number> = {
  admin: 3,
  creator: 2,
  viewer: 1,
};

/**
 * API Route에서 인증을 확인합니다.
 * 인증 실패 시 401 NextResponse를 반환합니다.
 */
export async function requireAuthAPI(): Promise<
  { user: { id: string; email?: string }; error?: never } | { user?: never; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      ),
    };
  }

  return { user };
}

/**
 * API Route에서 특정 역할 이상인지 확인합니다.
 * 인증 실패 시 401, 권한 부족 시 403을 반환합니다.
 */
export async function requireRoleAPI(
  minRole: AppRole
): Promise<
  { profile: UserProfile; error?: never } | { profile?: never; error: NextResponse }
> {
  const authResult = await requireAuthAPI();
  if (authResult.error) return { error: authResult.error };

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role, department, display_name")
    .eq("user_id", authResult.user.id)
    .single();

  const profile: UserProfile = {
    id: authResult.user.id,
    email: authResult.user.email || "",
    displayName: data?.display_name || authResult.user.email?.split("@")[0] || "",
    role: (data?.role as AppRole) || "viewer",
    department: (data?.department as AppDepartment) || null,
  };

  if (ROLE_HIERARCHY[profile.role] < ROLE_HIERARCHY[minRole]) {
    return {
      error: NextResponse.json(
        { error: "권한이 부족합니다" },
        { status: 403 }
      ),
    };
  }

  return { profile };
}
