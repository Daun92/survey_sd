"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleSurveyStatus(
  surveyId: string,
  newStatus: "active" | "closed"
) {
  const supabase = await createClient();
  const now = new Date();
  const updateData: Record<string, string> = {
    status: newStatus,
    updated_at: now.toISOString(),
  };

  // 재오픈 시 ends_at이 과거이면 +7일 자동 연장
  if (newStatus === "active") {
    const { data: survey } = await supabase
      .from("edu_surveys")
      .select("ends_at, starts_at")
      .eq("id", surveyId)
      .single();

    if (survey?.ends_at && new Date(survey.ends_at) <= now) {
      const newEnd = new Date(now);
      newEnd.setDate(newEnd.getDate() + 7);
      updateData.ends_at = newEnd.toISOString();
    }
    if (survey?.starts_at && new Date(survey.starts_at) > now) {
      updateData.starts_at = now.toISOString();
    }
  }

  const { error } = await supabase
    .from("edu_surveys")
    .update(updateData)
    .eq("id", surveyId);

  if (error) throw new Error("상태 변경 실패: " + error.message);

  revalidatePath("/admin/surveys");
}
