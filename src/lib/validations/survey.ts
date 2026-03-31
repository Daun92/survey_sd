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

// ─── 설문 생성 스키마 (camelCase — API 라우트 기준) ───

export const createSurveySchema = z.object({
  title: z.string().min(1, "제목을 입력해 주세요").max(300),
  serviceTypeId: z.number().int().positive("서비스유형을 선택해 주세요"),
  surveyYear: z.number().int().min(2020).max(2100),
  surveyMonth: z.number().int().min(1).max(12),
  trainingMonth: z.number().int().min(1).max(12).optional().nullable(),
  internalLabel: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  templateId: z.number().int().positive().optional(),
  cloneFromSurveyId: z.number().int().positive().optional(),
});

// API 라우트용 (camelCase — Prisma)
export const updateSurveyApiSchema = z.object({
  title: z.string().min(1, "제목을 입력해 주세요").max(300).optional(),
  status: surveyStatusSchema.optional(),
  description: z.string().max(2000).nullable().optional(),
  trainingMonth: z.number().int().min(1).max(12).nullable().optional(),
  internalLabel: z.string().max(200).nullable().optional(),
  showProjectName: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
});

// Server Actions용 (snake_case — Supabase)
export const updateSurveySchema = z.object({
  title: z.string().min(1, "제목을 입력해 주세요").max(300).optional(),
  status: z.string().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

// ─── 문항 스키마 (camelCase — Prisma API 라우트) ───

export const addQuestionApiSchema = z.object({
  questionOrder: z.number().int().min(0),
  questionText: z.string().min(1, "문항 텍스트를 입력해 주세요"),
  questionType: questionTypeSchema,
  category: z.string().max(100).optional().nullable(),
  isRequired: z.boolean().optional(),
  options: z.array(z.string()).nullable().optional(),
});

export const updateQuestionsApiSchema = z.object({
  questions: z.array(
    z.object({
      id: z.number().int().positive(),
      questionOrder: z.number().int().min(0),
      questionText: z.string().min(1),
      questionType: questionTypeSchema,
      category: z.string().max(100).optional().nullable(),
      isRequired: z.boolean().optional(),
      options: z.array(z.string()).nullable().optional(),
    })
  ).min(1, "최소 1개의 문항이 필요합니다"),
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

export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>;
export type AddQuestionInput = z.infer<typeof addQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
