"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { HrdAnswerType, ConditionalLogic, ValidationRule, AnswerOption } from "@/types/hrd-survey";

// ─── Part actions ───

export async function addPart(data: {
  round_id: string;
  part_code: string;
  part_name: string;
  description?: string;
  sort_order: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("hrd_survey_parts").insert({
    round_id: data.round_id,
    part_code: data.part_code,
    part_name: data.part_name,
    description: data.description || null,
    sort_order: data.sort_order,
    is_active: true,
  });

  if (error) throw new Error("파트 추가 실패: " + error.message);
  revalidatePath("/admin/hrd/design");
}

export async function updatePart(
  id: string,
  data: {
    part_name?: string;
    description?: string;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("hrd_survey_parts")
    .update(data)
    .eq("id", id);

  if (error) throw new Error("파트 수정 실패: " + error.message);
  revalidatePath("/admin/hrd/design");
}

export async function deletePart(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("hrd_survey_parts")
    .delete()
    .eq("id", id);

  if (error) throw new Error("파트 삭제 실패: " + error.message);
  revalidatePath("/admin/hrd/design");
}

// ─── Item actions ───

export async function addItem(data: {
  part_id: string;
  round_id: string;
  item_code: string;
  question_text: string;
  sub_item_text?: string;
  question_group?: string;
  answer_type: HrdAnswerType;
  answer_options?: AnswerOption[];
  is_required?: boolean;
  sort_order: number;
  placeholder?: string;
  unit?: string;
  help_text?: string;
  validation_rules?: ValidationRule;
  conditional_logic?: ConditionalLogic;
  is_benchmark_item?: boolean;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("hrd_survey_items").insert({
    part_id: data.part_id,
    round_id: data.round_id,
    item_code: data.item_code,
    question_text: data.question_text,
    sub_item_text: data.sub_item_text || null,
    question_group: data.question_group || null,
    answer_type: data.answer_type,
    answer_options: data.answer_options || null,
    is_required: data.is_required ?? true,
    sort_order: data.sort_order,
    placeholder: data.placeholder || null,
    unit: data.unit || null,
    help_text: data.help_text || null,
    validation_rules: data.validation_rules || null,
    conditional_logic: data.conditional_logic || null,
    is_benchmark_item: data.is_benchmark_item ?? false,
  });

  if (error) throw new Error("항목 추가 실패: " + error.message);
  revalidatePath("/admin/hrd/design");
}

export async function updateItem(
  id: string,
  data: {
    item_code?: string;
    question_text?: string;
    sub_item_text?: string;
    question_group?: string;
    answer_type?: HrdAnswerType;
    answer_options?: AnswerOption[];
    is_required?: boolean;
    sort_order?: number;
    placeholder?: string;
    unit?: string;
    help_text?: string;
    validation_rules?: ValidationRule;
    conditional_logic?: ConditionalLogic;
    is_benchmark_item?: boolean;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("hrd_survey_items")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("항목 수정 실패: " + error.message);
  revalidatePath("/admin/hrd/design");
}

export async function deleteItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("hrd_survey_items")
    .delete()
    .eq("id", id);

  if (error) throw new Error("항목 삭제 실패: " + error.message);
  revalidatePath("/admin/hrd/design");
}

export async function reorderItems(items: { id: string; sort_order: number }[]) {
  const supabase = await createClient();

  // 단일 upsert로 일괄 순서 변경 (기존 Promise.all 안티패턴 대체)
  const { error } = await supabase
    .from("hrd_survey_items")
    .upsert(
      items.map(({ id, sort_order }) => ({ id, sort_order })),
      { onConflict: "id", ignoreDuplicates: false }
    );

  if (error) throw new Error("순서 변경 실패: " + error.message);
  revalidatePath("/admin/hrd/design");
}
