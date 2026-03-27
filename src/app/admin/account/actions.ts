"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * 프로필(display_name)을 업데이트합니다.
 * user_roles 레코드가 없으면 viewer 기본값으로 자동 생성합니다.
 * role, department는 변경하지 않습니다 (admin만 가능).
 */
export async function updateProfile(displayName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("인증이 필요합니다");

  const trimmed = displayName.trim();
  if (!trimmed) throw new Error("이름을 입력해 주세요");
  if (trimmed.length > 50) throw new Error("이름은 50자 이내로 입력해 주세요");

  // 기존 레코드 확인
  const { data: existing } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // display_name만 업데이트 (role, department는 건드리지 않음)
    const { error } = await supabase
      .from("user_roles")
      .update({ display_name: trimmed, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) throw new Error("프로필 저장 실패: " + error.message);
  } else {
    // 첫 로그인 — viewer 기본값으로 생성
    const { error } = await supabase.from("user_roles").insert({
      user_id: user.id,
      role: "viewer",
      display_name: trimmed,
    });

    if (error) throw new Error("프로필 생성 실패: " + error.message);
  }

  revalidatePath("/admin");
}
