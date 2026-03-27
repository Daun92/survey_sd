"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// ─── Round actions ───

export async function createRound(data: {
  round_number: number;
  title: string;
  description?: string;
  year: number;
  target_count?: number;
  starts_at?: string;
  ends_at?: string;
}) {
  const { error } = await supabase.from("hrd_survey_rounds").insert({
    round_number: data.round_number,
    title: data.title,
    description: data.description || null,
    year: data.year,
    target_count: data.target_count ?? 300,
    starts_at: data.starts_at || null,
    ends_at: data.ends_at || null,
    status: "draft",
  });

  if (error) throw new Error("라운드 생성 실패: " + error.message);
  revalidatePath("/admin/hrd");
}

export async function updateRound(
  id: string,
  data: {
    title?: string;
    description?: string;
    year?: number;
    target_count?: number;
    starts_at?: string;
    ends_at?: string;
    status?: string;
  }
) {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.year !== undefined) updateData.year = data.year;
  if (data.target_count !== undefined) updateData.target_count = data.target_count;
  if (data.starts_at !== undefined) updateData.starts_at = data.starts_at || null;
  if (data.ends_at !== undefined) updateData.ends_at = data.ends_at || null;
  if (data.status !== undefined) updateData.status = data.status;

  const { error } = await supabase
    .from("hrd_survey_rounds")
    .update(updateData)
    .eq("id", id);

  if (error) throw new Error("라운드 수정 실패: " + error.message);
  revalidatePath("/admin/hrd");
}

export async function deleteRound(id: string) {
  // draft 상태만 삭제 가능
  const { data: round } = await supabase
    .from("hrd_survey_rounds")
    .select("status")
    .eq("id", id)
    .single();

  if (round?.status !== "draft") {
    throw new Error("준비중 상태의 라운드만 삭제할 수 있습니다");
  }

  const { error } = await supabase
    .from("hrd_survey_rounds")
    .delete()
    .eq("id", id);

  if (error) throw new Error("라운드 삭제 실패: " + error.message);
  revalidatePath("/admin/hrd");
}

// ─── Respondent actions ───

export async function addRespondent(data: {
  round_id: string;
  company_name: string;
  respondent_name?: string;
  respondent_position?: string;
  respondent_email?: string;
  respondent_phone?: string;
  org_type?: string;
  org_type_code?: number;
  industry_code?: string;
  biz_reg_no?: string;
}) {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  const { error } = await supabase.from("hrd_respondents").insert({
    round_id: data.round_id,
    company_name: data.company_name,
    respondent_name: data.respondent_name || null,
    respondent_position: data.respondent_position || null,
    respondent_email: data.respondent_email || null,
    respondent_phone: data.respondent_phone || null,
    org_type: data.org_type || null,
    org_type_code: data.org_type_code || null,
    industry_code: data.industry_code || null,
    biz_reg_no: data.biz_reg_no || null,
    url_token: token,
    status: "invited",
    source: "online",
  });

  if (error) throw new Error("응답자 추가 실패: " + error.message);
  revalidatePath("/admin/hrd/respondents");
}

export async function updateRespondent(
  id: string,
  data: {
    company_name?: string;
    respondent_name?: string;
    respondent_position?: string;
    respondent_email?: string;
    respondent_phone?: string;
    org_type?: string;
    org_type_code?: number;
    industry_code?: string;
  }
) {
  const { error } = await supabase
    .from("hrd_respondents")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("응답자 수정 실패: " + error.message);
  revalidatePath("/admin/hrd/respondents");
}

export async function deleteRespondent(id: string) {
  const { error } = await supabase
    .from("hrd_respondents")
    .delete()
    .eq("id", id);

  if (error) throw new Error("응답자 삭제 실패: " + error.message);
  revalidatePath("/admin/hrd/respondents");
}

export async function importRespondents(
  roundId: string,
  rows: Array<{
    company_name: string;
    respondent_name?: string;
    respondent_position?: string;
    respondent_email?: string;
    org_type?: string;
    org_type_code?: number;
    industry_code?: string;
    biz_reg_no?: string;
  }>
) {
  const insertData = rows.map((row) => ({
    round_id: roundId,
    company_name: row.company_name,
    respondent_name: row.respondent_name || null,
    respondent_position: row.respondent_position || null,
    respondent_email: row.respondent_email || null,
    org_type: row.org_type || null,
    org_type_code: row.org_type_code || null,
    industry_code: row.industry_code || null,
    biz_reg_no: row.biz_reg_no || null,
    url_token: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    status: "invited" as const,
    source: "import" as const,
  }));

  const { error } = await supabase.from("hrd_respondents").insert(insertData);

  if (error) throw new Error("일괄 등록 실패: " + error.message);
  revalidatePath("/admin/hrd/respondents");
  return { count: insertData.length };
}
