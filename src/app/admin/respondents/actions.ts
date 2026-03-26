"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export interface RespondentInput {
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  customer_id?: number | null;
  notes?: string;
}

export async function createRespondent(data: RespondentInput) {
  const { error } = await supabase.from("respondents").insert(data);
  if (error) throw new Error("응답자 추가 실패: " + error.message);
  revalidatePath("/admin/respondents");
}

export async function updateRespondent(id: string, data: Partial<RespondentInput>) {
  const { error } = await supabase
    .from("respondents")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("응답자 수정 실패: " + error.message);
  revalidatePath("/admin/respondents");
}

export async function deleteRespondent(id: string) {
  const { error } = await supabase.from("respondents").delete().eq("id", id);
  if (error) throw new Error("응답자 삭제 실패: " + error.message);
  revalidatePath("/admin/respondents");
}

export async function toggleRespondentActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from("respondents")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("상태 변경 실패: " + error.message);
  revalidatePath("/admin/respondents");
}
