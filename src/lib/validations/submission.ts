import { z } from "zod";

// ─── 응답 제출 스키마 ───

export const submitSurveySchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.number()])),
  respondent_name: z.string().max(100).optional(),
  respondent_department: z.string().max(100).optional(),
  respondent_position: z.string().max(100).optional(),
  class_group_id: z.string().optional(),
});

export const submitHrdResponseSchema = z.object({
  respondent_id: z.string().uuid(),
  responses: z.array(
    z.object({
      item_id: z.string().uuid(),
      value_text: z.string().nullable().optional(),
      value_number: z.number().nullable().optional(),
      value_json: z.unknown().nullable().optional(),
    })
  ),
  is_draft: z.boolean().optional(),
});

export type SubmitSurveyInput = z.infer<typeof submitSurveySchema>;
export type SubmitHrdResponseInput = z.infer<typeof submitHrdResponseSchema>;
