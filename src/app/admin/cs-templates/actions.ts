"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── 템플릿 settings 조회 ──
export async function getTemplateSettings(templateId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cs_survey_templates")
    .select("settings")
    .eq("id", templateId)
    .single();
  return (data?.settings as Record<string, unknown>) ?? {};
}

// ── 템플릿 복제 ──
export async function duplicateTemplate(templateId: string) {
  const supabase = await createClient();
  // 원본 템플릿 조회
  const { data: original } = await supabase
    .from("cs_survey_templates")
    .select("name, division, division_label, description, settings")
    .eq("id", templateId)
    .single();

  if (!original) throw new Error("원본 템플릿을 찾을 수 없습니다.");

  // 복제 템플릿 생성 (사용자 복제본은 항상 is_system=false)
  const { data: newTemplate, error: createError } = await supabase
    .from("cs_survey_templates")
    .insert({
      name: `${original.name} (복제)`,
      division: original.division,
      division_label: original.division_label,
      description: original.description,
      settings: original.settings,
      is_active: true,
      is_system: false,
    })
    .select("id")
    .single();

  if (createError || !newTemplate) throw new Error("템플릿 복제 실패: " + createError?.message);

  // 문항 복제: skip_logic, metadata, is_required 까지 전부 select
  const { data: questions } = await supabase
    .from("cs_survey_questions")
    .select(
      "id, page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes, is_required, skip_logic, metadata"
    )
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });

  if (questions && questions.length > 0) {
    // 1차 insert: skip_logic 제외 → 새 id 확보
    const toInsert = questions.map((q) => {
      const { id, skip_logic, ...rest } = q;
      void id;
      void skip_logic;
      return { ...rest, template_id: newTemplate.id };
    });

    const { data: inserted, error: insertError } = await supabase
      .from("cs_survey_questions")
      .insert(toInsert)
      .select("id, sort_order");

    if (insertError) throw new Error("문항 복제 실패: " + insertError.message);

    // 구 id → 신 id 매핑 (sort_order 기준)
    const idMap = new Map<string, string>();
    for (const orig of questions) {
      const match = inserted?.find((n) => n.sort_order === orig.sort_order);
      if (match) idMap.set(orig.id, match.id);
    }

    // skip_logic의 question_id를 새 id로 치환하며 update
    for (const orig of questions) {
      const sl = orig.skip_logic as { show_when?: { question_id?: string } } | null;
      if (!sl?.show_when?.question_id) continue;
      const newId = idMap.get(orig.id);
      const remappedTarget = idMap.get(sl.show_when.question_id);
      if (!newId || !remappedTarget) continue;
      await supabase
        .from("cs_survey_questions")
        .update({
          skip_logic: {
            show_when: { ...sl.show_when, question_id: remappedTarget },
          },
        })
        .eq("id", newId);
    }
  }

  revalidatePath("/admin/cs-templates");
  return newTemplate.id;
}

// ── 프로젝트 설문을 템플릿으로 저장 ──
export async function createTemplateFromSurvey(surveyId: string, name: string) {
  const supabase = await createClient();
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

  // 설문 문항 → 템플릿 문항으로 복사 (분기/필수/옵션/메타데이터 보존)
  const { data: questions } = await supabase
    .from("edu_questions")
    .select(
      "id, question_code, question_text, question_type, section, sort_order, options, is_required, skip_logic, metadata"
    )
    .eq("survey_id", surveyId)
    .order("sort_order", { ascending: true });

  if (questions && questions.length > 0) {
    // 1차 insert: skip_logic 제외 → 새 id 확보
    const toInsert = questions.map((q, idx) => {
      // options 정규화 (JSON 배열 또는 문자열로 저장된 경우 둘 다 허용)
      let optionArray: string[] | null = null;
      if (q.options) {
        try {
          const parsed = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
          if (Array.isArray(parsed)) optionArray = parsed.map(String);
        } catch {
          /* noop */
        }
      }

      // metadata에 원본 options 를 보존해 두면 quickCreateSurvey 에서 정확히 복원 가능
      const baseMetadata = (q.metadata as Record<string, unknown> | null) ?? null;
      const mergedMetadata = optionArray
        ? { ...(baseMetadata ?? {}), source_options: optionArray }
        : baseMetadata;

      const code = q.question_code || `Q${idx + 1}`;
      return {
        template_id: template.id,
        page_type: "1P",
        question_no: code,
        result_column: code,
        question_text: q.question_text,
        question_type: q.question_type, // 복수/단일/리커트 타입 그대로 보존
        response_options: optionArray ? optionArray.join("/") : null,
        section_label: q.section,
        sort_order: q.sort_order,
        is_required: q.is_required ?? true,
        metadata: mergedMetadata,
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from("cs_survey_questions")
      .insert(toInsert)
      .select("id, sort_order");

    if (insertError) throw new Error("문항 복제 실패: " + insertError.message);

    // 구 id → 신 id 매핑 (sort_order 기준)
    const idMap = new Map<string, string>();
    for (const orig of questions) {
      const match = inserted?.find((n) => n.sort_order === orig.sort_order);
      if (match) idMap.set(orig.id, match.id);
    }

    // skip_logic의 question_id 를 새 template question id 로 치환
    for (const orig of questions) {
      const sl = orig.skip_logic as { show_when?: { question_id?: string } } | null;
      if (!sl?.show_when?.question_id) continue;
      const newId = idMap.get(orig.id);
      const remappedTarget = idMap.get(sl.show_when.question_id);
      if (!newId || !remappedTarget) continue;
      await supabase
        .from("cs_survey_questions")
        .update({
          skip_logic: {
            show_when: { ...sl.show_when, question_id: remappedTarget },
          },
        })
        .eq("id", newId);
    }
  }

  revalidatePath("/admin/cs-templates");
  return template.id;
}

// ── 템플릿 삭제 (시스템 템플릿은 불가) ──
export async function deleteTemplate(templateId: string) {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  await supabase.from("cs_survey_templates").update({ is_active: true }).eq("id", templateId);
  revalidatePath("/admin/cs-templates");
}

// ── 템플릿 이름/설명 수정 ──
export async function updateTemplate(templateId: string, data: { name?: string; description?: string }) {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();

  // 단일 upsert로 일괄 순서 변경 (기존 Promise.all 안티패턴 대체)
  const { error } = await supabase
    .from("cs_survey_questions")
    .upsert(
      orderedIds.map(({ id, sort_order }) => ({ id, sort_order })),
      { onConflict: "id", ignoreDuplicates: false }
    );

  if (error) throw new Error("순서 변경 실패: " + error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 문항 섹션 이동 ──
export async function updateQuestionSectionLabel(
  questionId: string,
  templateId: string,
  newSection: string
) {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("cs_survey_templates")
    .select("settings")
    .eq("id", templateId)
    .single();

  const settings = (template?.settings as Record<string, unknown>) ?? {};
  const intros = (settings.section_intros as Record<string, unknown>) ?? {};

  // 기존 인트로와 merge하고 undefined 값 제거
  const existing = (intros[sectionName] as Record<string, unknown>) ?? {};
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(intro)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  intros[sectionName] = merged;

  const { error } = await supabase
    .from("cs_survey_templates")
    .update({ settings: { ...settings, section_intros: intros }, updated_at: new Date().toISOString() })
    .eq("id", templateId);
  if (error) throw new Error("섹션 안내 저장 실패: " + error.message);
  revalidatePath(`/admin/cs-templates/${templateId}`);
}

// ── 빈 섹션 삭제 ──
export async function deleteTemplateSection(templateId: string, sectionName: string) {
  const supabase = await createClient();
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
