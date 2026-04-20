import { z } from "zod";

// ─── 응답 제출 스키마 ───

export const submitSurveySchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.number()])),
  respondent_name: z.string().max(100).nullable().optional(),
  respondent_department: z.string().max(100).nullable().optional(),
  respondent_position: z.string().max(100).nullable().optional(),
  respondent_info: z.record(z.string(), z.string()).optional(),
  class_group_id: z.string().nullable().optional(),
  distribution_token: z.string().max(64).nullable().optional(),
  // 테스트 제출 플래그 — 공통 링크 ?test=1 경로에서 전달됨. 집계·리포트에서 자동 제외.
  is_test: z.boolean().optional(),
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
