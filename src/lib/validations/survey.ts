import { z } from "zod";

// ─── 설문 관련 스키마 ───

export const surveyStatusSchema = z.enum([
  "draft",
  "active",
  "distributing",
  "paused",
  "closed",
  "archived",
]);

export const questionTypeSchema = z.enum([
  "likert_5",
  "likert_7",
  "single_choice",
  "multiple_choice",
  "text",
  "number",
  "rating",
]);

// Server Actions용 (snake_case — Supabase)
export const updateSurveySchema = z.object({
  title: z.string().min(1, "제목을 입력해 주세요").max(300).optional(),
  status: z.string().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

// ─── Server Actions용 스키마 (snake_case — Supabase 직접 사용) ───

export const addQuestionSchema = z.object({
  question_text: z.string().min(1, "문항 텍스트를 입력해 주세요"),
  question_type: z.string().min(1),
  question_code: z.string().max(30).optional(),
  section: z.string().max(100).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  options: z.array(z.string()).nullable().optional(),
});

export const updateQuestionSchema = z.object({
  question_text: z.string().min(1).optional(),
  question_type: z.string().optional(),
  question_code: z.string().max(30).optional(),
  section: z.string().max(100).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  options: z.array(z.string()).nullable().optional(),
});

export const reorderQuestionsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    sort_order: z.number().int().min(0),
  })
);

// ─── Types ───

export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>;
export type AddQuestionInput = z.infer<typeof addQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
