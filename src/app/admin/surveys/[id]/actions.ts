"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// ─── Survey actions ───

export async function updateSurvey(
  surveyId: string,
  data: {
    title?: string;
    status?: string;
    starts_at?: string | null;
    ends_at?: string | null;
    description?: string | null;
  }
) {
  const { error } = await supabase
    .from("edu_surveys")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", surveyId);

  if (error) throw new Error("설문 수정 실패: " + error.message);
  revalidatePath(`/admin/surveys/${surveyId}`);
}

export async function deleteSurvey(surveyId: string) {
  // Delete questions first
  const { error: qError } = await supabase
    .from("edu_questions")
    .delete()
    .eq("survey_id", surveyId);

  if (qError) throw new Error("문항 삭제 실패: " + qError.message);

  const { error } = await supabase
    .from("edu_surveys")
    .delete()
    .eq("id", surveyId);

  if (error) throw new Error("설문 삭제 실패: " + error.message);
  revalidatePath("/admin/surveys");
}

// ─── Question actions ───

export async function addQuestion(
  surveyId: string,
  data: {
    question_text: string;
    question_type: string;
    question_code?: string;
    section?: string;
    is_required?: boolean;
    sort_order?: number;
    options?: string[] | null;
  }
) {
  const { data: question, error } = await supabase
    .from("edu_questions")
    .insert({
      survey_id: surveyId,
      question_text: data.question_text,
      question_type: data.question_type,
      question_code: data.question_code || null,
      section: data.section || "일반",
      is_required: data.is_required ?? true,
      sort_order: data.sort_order ?? 0,
      options: data.options ? JSON.stringify(data.options) : null,
    })
    .select("*")
    .single();

  if (error) throw new Error("문항 추가 실패: " + error.message);
  revalidatePath(`/admin/surveys/${surveyId}`);
  return question;
}

export async function updateQuestion(
  questionId: string,
  surveyId: string,
  data: {
    question_text?: string;
    question_type?: string;
    question_code?: string;
    section?: string;
    is_required?: boolean;
    sort_order?: number;
    options?: string[] | null;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (data.question_text !== undefined) updateData.question_text = data.question_text;
  if (data.question_type !== undefined) updateData.question_type = data.question_type;
  if (data.question_code !== undefined) updateData.question_code = data.question_code;
  if (data.section !== undefined) updateData.section = data.section;
  if (data.is_required !== undefined) updateData.is_required = data.is_required;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
  if (data.options !== undefined) {
    updateData.options = data.options ? JSON.stringify(data.options) : null;
  }

  const { error } = await supabase
    .from("edu_questions")
    .update(updateData)
    .eq("id", questionId);

  if (error) throw new Error("문항 수정 실패: " + error.message);
  revalidatePath(`/admin/surveys/${surveyId}`);
}

export async function deleteQuestion(questionId: string, surveyId: string) {
  const { error } = await supabase
    .from("edu_questions")
    .delete()
    .eq("id", questionId);

  if (error) throw new Error("문항 삭제 실패: " + error.message);
  revalidatePath(`/admin/surveys/${surveyId}`);
}

export async function reorderQuestions(
  surveyId: string,
  orderedIds: { id: string; sort_order: number }[]
) {
  // Update each question's sort_order
  const promises = orderedIds.map(({ id, sort_order }) =>
    supabase
      .from("edu_questions")
      .update({ sort_order })
      .eq("id", id)
  );

  const results = await Promise.all(promises);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error("순서 변경 실패: " + failed.error.message);
  revalidatePath(`/admin/surveys/${surveyId}`);
}
