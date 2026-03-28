"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// ── 템플릿 settings 조회 ──
export async function getTemplateSettings(templateId: string) {
  const { data } = await supabase
    .from("cs_survey_templates")
    .select("settings")
    .eq("id", templateId)
    .single();
  return (data?.settings as Record<string, unknown>) ?? {};
}

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
    const { error: insertError } = await supabase.from("cs_survey_questions").insert(copied);
    if (insertError) throw new Error("문항 복제 실패: " + insertError.message);
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
    const templateQuestions = questions.map((q, idx) => ({
      template_id: template.id,
      page_type: "1P",
      question_no: q.question_code || `Q${idx + 1}`,
      question_text: q.question_text,
      question_type: q.question_type === "multiple_choice" ? "single_choice" : q.question_type,
      response_options: q.options ? (typeof q.options === "string" ? q.options : JSON.parse(q.options)?.join("/")) : null,
      section_label: q.section,
      sort_order: q.sort_order,
    }));
    const { error: insertError } = await supabase.from("cs_survey_questions").insert(templateQuestions);
    if (insertError) throw new Error("문항 복제 실패: " + insertError.message);
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
  revalidatePath(`/admin/cs-templates/${templateId}`);
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
  is_required?: boolean;
  skip_logic?: unknown;
  metadata?: unknown;
}) {
  const { skip_logic, metadata, ...rest } = data;
  const insertData: Record<string, unknown> = {
    template_id: templateId,
    ...rest,
    page_type: data.page_type || "1P",
    result_column: data.question_no || "",
    is_required: data.is_required ?? true,
  };
  if (skip_logic) insertData.skip_logic = skip_logic;
  if (metadata) insertData.metadata = metadata;

  const { error } = await supabase.from("cs_survey_questions").insert(insertData);
  if (error) throw new Error("문항 추가 실패: " + error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 템플릿 문항 수정 ──
export async function updateTemplateQuestion(questionId: string, templateId: string, data: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {};
  const fields = ["question_no", "question_text", "question_type", "response_options", "section_label", "is_required"];
  for (const key of fields) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }
  if (data.skip_logic !== undefined) updateData.skip_logic = data.skip_logic;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

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

// ── 템플릿 설정(settings JSONB) 머지 저장 ──
export async function updateTemplateSettings(
  templateId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: Record<string, any>
) {
  const { data: current } = await supabase
    .from("cs_survey_templates")
    .select("settings")
    .eq("id", templateId)
    .single();

  const merged = { ...((current?.settings as Record<string, unknown>) ?? {}), ...settings };

  const { error } = await supabase
    .from("cs_survey_templates")
    .update({ settings: merged, updated_at: new Date().toISOString() })
    .eq("id", templateId);

  if (error) throw new Error("설정 저장 실패: " + error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 문항 순서 일괄 업데이트 (드래그앤드롭) ──
export async function reorderTemplateQuestions(
  templateId: string,
  orderedIds: { id: string; sort_order: number }[]
) {
  const promises = orderedIds.map(({ id, sort_order }) =>
    supabase.from("cs_survey_questions").update({ sort_order }).eq("id", id)
  );
  const results = await Promise.all(promises);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error("순서 변경 실패: " + failed.error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 문항 섹션 이동 ──
export async function updateQuestionSectionLabel(
  questionId: string,
  templateId: string,
  newSection: string
) {
  const { error } = await supabase
    .from("cs_survey_questions")
    .update({ section_label: newSection })
    .eq("id", questionId);
  if (error) throw new Error("섹션 이동 실패: " + error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 섹션 이름 변경 ──
export async function renameTemplateSection(
  templateId: string,
  oldName: string,
  newName: string
) {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("섹션 이름을 입력해 주세요");

  const { error } = await supabase
    .from("cs_survey_questions")
    .update({ section_label: trimmed })
    .eq("template_id", templateId)
    .eq("section_label", oldName);
  if (error) throw new Error("섹션 이름 변경 실패: " + error.message);

  // section_intros 키 마이그레이션
  const { data: template } = await supabase
    .from("cs_survey_templates")
    .select("settings")
    .eq("id", templateId)
    .single();

  const settings = (template?.settings as Record<string, unknown>) ?? {};
  const intros = (settings.section_intros as Record<string, unknown>) ?? {};
  if (intros[oldName]) {
    intros[trimmed] = intros[oldName];
    delete intros[oldName];
    await supabase
      .from("cs_survey_templates")
      .update({ settings: { ...settings, section_intros: intros }, updated_at: new Date().toISOString() })
      .eq("id", templateId);
  }

  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 섹션 인트로 저장 ──
export async function updateTemplateSectionIntro(
  templateId: string,
  sectionName: string,
  intro: { title?: string; description?: string; color?: string; image_url?: string; image_size?: string }
) {
  const { data: template } = await supabase
    .from("cs_survey_templates")
    .select("settings")
    .eq("id", templateId)
    .single();

  const settings = (template?.settings as Record<string, unknown>) ?? {};
  const intros = (settings.section_intros as Record<string, unknown>) ?? {};
  intros[sectionName] = intro;

  const { error } = await supabase
    .from("cs_survey_templates")
    .update({ settings: { ...settings, section_intros: intros }, updated_at: new Date().toISOString() })
    .eq("id", templateId);
  if (error) throw new Error("섹션 안내 저장 실패: " + error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 빈 섹션 삭제 ──
export async function deleteTemplateSection(templateId: string, sectionName: string) {
  const { count } = await supabase
    .from("cs_survey_questions")
    .select("*", { count: "exact", head: true })
    .eq("template_id", templateId)
    .eq("section_label", sectionName);

  if ((count ?? 0) > 0) {
    throw new Error("문항이 있는 섹션은 삭제할 수 없습니다. 먼저 문항을 이동해 주세요.");
  }

  const { data: template } = await supabase
    .from("cs_survey_templates")
    .select("settings")
    .eq("id", templateId)
    .single();

  const settings = (template?.settings as Record<string, unknown>) ?? {};
  const intros = (settings.section_intros as Record<string, unknown>) ?? {};
  delete intros[sectionName];

  await supabase
    .from("cs_survey_templates")
    .update({ settings: { ...settings, section_intros: intros }, updated_at: new Date().toISOString() })
    .eq("id", templateId);

  revalidatePath(`/admin/cs-templates/${templateId}`);
}
