"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// ── 템플릿 복제 ──
export async function duplicateTemplate(templateId: string) {
  // 원본 템플릿 조회
  const { data: original } = await supabase
    .from("cs_survey_templates")
    .select("name, division, division_label, description")
    .eq("id", templateId)
    .single();

  if (!original) throw new Error("원본 템플릿을 찾을 수 없습니다.");

  // 복제 템플릿 생성
  const { data: newTemplate, error: createError } = await supabase
    .from("cs_survey_templates")
    .insert({
      name: `${original.name} (복제)`,
      division: original.division,
      division_label: original.division_label,
      description: original.description,
      is_active: true,
      is_system: false,
    })
    .select("id")
    .single();

  if (createError || !newTemplate) throw new Error("템플릿 복제 실패: " + createError?.message);

  // 문항 복제
  const { data: questions } = await supabase
    .from("cs_survey_questions")
    .select("page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });

  if (questions && questions.length > 0) {
    const copied = questions.map((q) => ({ ...q, template_id: newTemplate.id }));
    await supabase.from("cs_survey_questions").insert(copied);
  }

  revalidatePath("/admin/cs-templates");
  return newTemplate.id;
}

// ── 프로젝트 설문을 템플릿으로 저장 ──
export async function createTemplateFromSurvey(surveyId: string, name: string) {
  // 설문 조회
  const { data: survey } = await supabase
    .from("edu_surveys")
    .select("title, education_type")
    .eq("id", surveyId)
    .single();

  if (!survey) throw new Error("설문을 찾을 수 없습니다.");

  // 템플릿 생성
  const { data: template, error: createError } = await supabase
    .from("cs_survey_templates")
    .insert({
      name: name || `${survey.title} 템플릿`,
      division: survey.education_type || "custom",
      division_label: "커스텀",
      description: `${survey.title}에서 생성된 템플릿`,
      is_active: true,
      is_system: false,
    })
    .select("id")
    .single();

  if (createError || !template) throw new Error("템플릿 생성 실패: " + createError?.message);

  // 설문 문항 → 템플릿 문항으로 복사
  const { data: questions } = await supabase
    .from("edu_questions")
    .select("question_code, question_text, question_type, section, sort_order, options")
    .eq("survey_id", surveyId)
    .order("sort_order", { ascending: true });

  if (questions && questions.length > 0) {
    const templateQuestions = questions.map((q) => ({
      template_id: template.id,
      page_type: "1P",
      question_no: q.question_code || `Q${q.sort_order + 1}`,
      question_text: q.question_text,
      question_type: q.question_type === "multiple_choice" ? "single_choice" : q.question_type,
      response_options: q.options ? (typeof q.options === "string" ? q.options : JSON.parse(q.options)?.join("/")) : null,
      section_label: q.section,
      sort_order: q.sort_order,
    }));
    await supabase.from("cs_survey_questions").insert(templateQuestions);
  }

  revalidatePath("/admin/cs-templates");
  return template.id;
}

// ── 템플릿 삭제 (시스템 템플릿은 불가) ──
export async function deleteTemplate(templateId: string) {
  const { data: template } = await supabase
    .from("cs_survey_templates")
    .select("is_system")
    .eq("id", templateId)
    .single();

  if (!template) throw new Error("템플릿을 찾을 수 없습니다.");
  if (template.is_system) throw new Error("기본 템플릿은 삭제할 수 없습니다.");

  // 문항 먼저 삭제 (CASCADE가 설정되어 있으면 불필요하지만 안전하게)
  await supabase.from("cs_survey_questions").delete().eq("template_id", templateId);
  const { error } = await supabase.from("cs_survey_templates").delete().eq("id", templateId);
  if (error) throw new Error("삭제 실패: " + error.message);

  revalidatePath("/admin/cs-templates");
}

// ── 템플릿 보관 (비활성화) ──
export async function archiveTemplate(templateId: string) {
  const { data: template } = await supabase
    .from("cs_survey_templates")
    .select("is_system")
    .eq("id", templateId)
    .single();

  if (!template) throw new Error("템플릿을 찾을 수 없습니다.");
  if (template.is_system) throw new Error("기본 템플릿은 보관할 수 없습니다.");

  await supabase.from("cs_survey_templates").update({ is_active: false }).eq("id", templateId);
  revalidatePath("/admin/cs-templates");
}

// ── 템플릿 복원 (활성화) ──
export async function restoreTemplate(templateId: string) {
  await supabase.from("cs_survey_templates").update({ is_active: true }).eq("id", templateId);
  revalidatePath("/admin/cs-templates");
}

// ── 템플릿 이름/설명 수정 ──
export async function updateTemplate(templateId: string, data: { name?: string; description?: string }) {
  const { error } = await supabase
    .from("cs_survey_templates")
    .update(data)
    .eq("id", templateId);
  if (error) throw new Error("수정 실패: " + error.message);
  revalidatePath("/admin/cs-templates");
}

// ── 템플릿 문항 추가 ──
export async function addTemplateQuestion(templateId: string, data: {
  question_no: string;
  question_text: string;
  question_type: string;
  response_options?: string;
  section_label?: string;
  page_type?: string;
  sort_order: number;
}) {
  const { error } = await supabase
    .from("cs_survey_questions")
    .insert({ template_id: templateId, ...data, page_type: data.page_type || "1P" });
  if (error) throw new Error("문항 추가 실패: " + error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 템플릿 문항 수정 ──
export async function updateTemplateQuestion(questionId: string, templateId: string, data: {
  question_no?: string;
  question_text?: string;
  question_type?: string;
  response_options?: string;
  section_label?: string;
}) {
  const updateData: Record<string, unknown> = {};
  if (data.question_no !== undefined) updateData.question_no = data.question_no;
  if (data.question_text !== undefined) updateData.question_text = data.question_text;
  if (data.question_type !== undefined) updateData.question_type = data.question_type;
  if (data.response_options !== undefined) updateData.response_options = data.response_options;
  if (data.section_label !== undefined) updateData.section_label = data.section_label;

  const { error } = await supabase.from("cs_survey_questions").update(updateData).eq("id", questionId);
  if (error) throw new Error("문항 수정 실패: " + error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 템플릿 문항 삭제 ──
export async function deleteTemplateQuestion(questionId: string, templateId: string) {
  const { error } = await supabase.from("cs_survey_questions").delete().eq("id", questionId);
  if (error) throw new Error("문항 삭제 실패: " + error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}
