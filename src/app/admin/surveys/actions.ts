"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleSurveyStatus(
  surveyId: string,
  newStatus: "active" | "closed"
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("edu_surveys")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", surveyId);

  if (error) throw new Error("상태 변경 실패: " + error.message);

  revalidatePath("/admin/surveys");
}
