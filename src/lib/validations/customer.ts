import { z } from "zod";

// ─── 고객사 관련 스키마 ───

export const createCustomerSchema = z.object({
  companyName: z.string().min(1, "회사명을 입력해 주세요").max(200),
  serviceTypeId: z.number().int().positive("서비스유형을 선택해 주세요"),
  contactName: z.string().max(100).optional().nullable(),
  contactTitle: z.string().max(50).optional().nullable(),
  email: z.string().email("유효한 이메일을 입력해 주세요").optional().nullable().or(z.literal("")),
  phone: z.string().max(30).optional().nullable(),
  salesRep: z.string().max(100).optional().nullable(),
  salesTeam: z.string().max(100).optional().nullable(),
  ecoScore: z.number().int().min(0).max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
