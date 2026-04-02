import { z } from "zod";

// ─── 배포 CSV 행 스키마 ───

export const distributionRowSchema = z.object({
  company: z.string().min(1, "회사명 필수"),
  name: z.string().min(1, "담당자명 필수"),
  email: z.string().default(""),
  phone: z.string().default(""),
  phoneNormalized: z.string().default(""),
  emailValid: z.boolean(),
  project: z.string().default(""),
  course: z.string().default(""),
  am: z.string().default(""),
  team: z.string().default(""),
  rowNumber: z.number(),
});

export const createBatchSchema = z.object({
  surveyId: z.string().uuid("유효한 설문 ID가 필요합니다"),
  rows: z.array(distributionRowSchema).min(1, "최소 1건의 데이터가 필요합니다"),
  isTest: z.boolean().optional().default(false),
});

export type DistributionRow = z.infer<typeof distributionRowSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
