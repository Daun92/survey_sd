"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import {
  updateSurveySchema,
  addQuestionSchema,
  updateQuestionSchema,
  reorderQuestionsSchema,
  type UpdateSurveyInput,
  type AddQuestionInput,
  type UpdateQuestionInput,
} from "@/lib/validations/survey";

// ─── Survey actions ───

export async function updateSurvey(surveyId: string, data: UpdateSurveyInput) {
  const parsed = updateSurveySchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("입력값 오류: " + parsed.error.issues[0].message);
  }

  const { error } = await supabase
    .from("edu_surveys")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", surveyId);

  if (error) throw new Error("설문 수정 실패: " + error.message);
  revalidatePath(`/admin/surveys/${surveyId}`);
}

export async function updateSurveySettings(
  surveyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: Record<string, any>
) {
  // 기존 settings를 merge
  const { data: current } = await supabase
    .from("edu_surveys")
    .select("settings")
    .eq("id", surveyId)
    .single();

  const merged = { ...((current?.settings as Record<string, unknown>) ?? {}), ...settings };

  const { error } = await supabase
    .from("edu_surveys")
    .update({ settings: merged, updated_at: new Date().toISOString() })
    .eq("id", surveyId);

  if (error) throw new Error("설정 저장 실패: " + error.message);
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

export async function addQuestion(surveyId: string, data: AddQuestionInput) {
  const parsed = addQuestionSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("입력값 오류: " + parsed.error.issues[0].message);
  }

  const insertData: Record<string, unknown> = {
    survey_id: surveyId,
    question_text: parsed.data.question_text,
    question_type: parsed.data.question_type,
    question_code: parsed.data.question_code || null,
    section: parsed.data.section || "일반",
    is_required: parsed.data.is_required ?? true,
    sort_order: parsed.data.sort_order ?? 0,
    options: parsed.data.options ? JSON.stringify(parsed.data.options) : null,
  };
  const skipLogic = (data as Record<string, unknown>).skip_logic;
  if (skipLogic) insertData.skip_logic = skipLogic;
  const metadata = (data as Record<string, unknown>).metadata;
  if (metadata) insertData.metadata = metadata;

  const { data: question, error } = await supabase
    .from("edu_questions")
    .insert(insertData)
    .select("*")
    .single();

  if (error) throw new Error("문항 추가 실패: " + error.message);
  revalidatePath(`/admin/surveys/${surveyId}`);
  return question;
}

export async function updateQuestion(
  questionId: string,
  surveyId: string,
  data: UpdateQuestionInput
) {
  const parsed = updateQuestionSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("입력값 오류: " + parsed.error.issues[0].message);
  }
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
  const skipLogicVal = (data as Record<string, unknown>).skip_logic;
  if (skipLogicVal !== undefined && skipLogicVal !== null) {
    updateData.skip_logic = skipLogicVal;
  }
  const metadataVal = (data as Record<string, unknown>).metadata;
  if (metadataVal !== undefined) {
    updateData.metadata = metadataVal;
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
  const parsed = reorderQuestionsSchema.safeParse(orderedIds);
  if (!parsed.success) {
    throw new Error("입력값 오류: " + parsed.error.issues[0].message);
  }
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

// ─── Section actions ───

export async function renameSection(
  surveyId: string,
  oldName: string,
  newName: string
) {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("섹션 이름을 입력해 주세요");

  const { error } = await supabase
    .from("edu_questions")
    .update({ section: trimmed })
    .eq("survey_id", surveyId)
    .eq("section", oldName);

  if (error) throw new Error("섹션 이름 변경 실패: " + error.message);

  // section_intros 키도 마이그레이션
  const { data: survey } = await supabase
    .from("edu_surveys")
    .select("settings")
    .eq("id", surveyId)
    .single();

  const settings = (survey?.settings as Record<string, unknown>) ?? {};
  const intros = (settings.section_intros as Record<string, unknown>) ?? {};
  if (intros[oldName]) {
    intros[trimmed] = intros[oldName];
    delete intros[oldName];
    await supabase
      .from("edu_surveys")
      .update({ settings: { ...settings, section_intros: intros }, updated_at: new Date().toISOString() })
      .eq("id", surveyId);
  }

  revalidatePath(`/admin/surveys/${surveyId}`);
}

export async function updateSectionIntro(
  surveyId: string,
  sectionName: string,
  intro: { title?: string; description?: string; color?: string; image_url?: string; image_size?: string }
) {
  const { data: survey } = await supabase
    .from("edu_surveys")
    .select("settings")
    .eq("id", surveyId)
    .single();

  const settings = (survey?.settings as Record<string, unknown>) ?? {};
  const intros = (settings.section_intros as Record<string, unknown>) ?? {};
  intros[sectionName] = intro;

  const { error } = await supabase
    .from("edu_surveys")
    .update({ settings: { ...settings, section_intros: intros }, updated_at: new Date().toISOString() })
    .eq("id", surveyId);

  if (error) throw new Error("섹션 안내 저장 실패: " + error.message);
  revalidatePath(`/admin/surveys/${surveyId}`);
}

export async function deleteSection(surveyId: string, sectionName: string) {
  const { count } = await supabase
    .from("edu_questions")
    .select("*", { count: "exact", head: true })
    .eq("survey_id", surveyId)
    .eq("section", sectionName);

  if ((count ?? 0) > 0) {
    throw new Error("질문이 있는 섹션은 삭제할 수 없습니다. 먼저 질문을 이동해 주세요.");
  }

  const { data: survey } = await supabase
    .from("edu_surveys")
    .select("settings")
    .eq("id", surveyId)
    .single();

  const settings = (survey?.settings as Record<string, unknown>) ?? {};
  const intros = (settings.section_intros as Record<string, unknown>) ?? {};
  delete intros[sectionName];

  await supabase
    .from("edu_surveys")
    .update({ settings: { ...settings, section_intros: intros }, updated_at: new Date().toISOString() })
    .eq("id", surveyId);

  revalidatePath(`/admin/surveys/${surveyId}`);
}

export async function updateQuestionSection(
  questionId: string,
  surveyId: string,
  newSection: string
) {
  const { error } = await supabase
    .from("edu_questions")
    .update({ section: newSection })
    .eq("id", questionId);

  if (error) throw new Error("섹션 이동 실패: " + error.message);
  revalidatePath(`/admin/surveys/${surveyId}`);
}
