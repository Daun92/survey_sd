import { z } from "zod";

// ─── 개별 링크 배부 스키마 ───

export const recipientSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다").max(100),
  email: z.string().email().max(255).nullable().optional(),
  company: z.string().max(100).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
});

export const createBatchSchema = z.object({
  survey_id: z.string().uuid("유효한 설문 ID가 필요합니다"),
  recipients: z
    .array(recipientSchema)
    .min(1, "최소 1명의 수신자가 필요합니다")
    .max(100, "최대 100명까지 일괄 생성 가능합니다"),
});

export type RecipientInput = z.infer<typeof recipientSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
