"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface RespondentInput {
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  customer_id?: number | null;
  notes?: string;
}

export async function createRespondent(data: RespondentInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("respondents").insert(data);
  if (error) throw new Error("응답자 추가 실패: " + error.message);
  revalidatePath("/admin/respondents");
}

export async function updateRespondent(id: string, data: Partial<RespondentInput>) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("respondents")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("응답자 수정 실패: " + error.message);
  revalidatePath("/admin/respondents");
}

export async function deleteRespondent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("respondents").delete().eq("id", id);
  if (error) throw new Error("응답자 삭제 실패: " + error.message);
  revalidatePath("/admin/respondents");
}

export async function toggleRespondentActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("respondents")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("상태 변경 실패: " + error.message);
  revalidatePath("/admin/respondents");
}

export interface BulkRow {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  department?: string;
  position?: string;
}

export interface BulkImportResult {
  inserted: number;
  updated: number;
  skipped: number;
}

/**
 * CSV 일괄 업로드: email 기반 upsert.
 * - company 이름이 customers.company_name 에 정확히 1건 매칭되면 customer_id 자동 세팅.
 * - email 이 없는 row 는 중복 감지 불가 → 매번 신규 insert (skipped 로 카운트하지 않음).
 */
export async function bulkImportRespondents(rows: BulkRow[]): Promise<BulkImportResult> {
  const supabase = await createClient();

  // 고객사 단일 매칭 맵 구축
  const companies = [...new Set(rows.map((r) => r.company).filter(Boolean) as string[])];
  const customerMap = new Map<string, number>();
  if (companies.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, company_name")
      .in("company_name", companies);

    if (customers) {
      const counts = new Map<string, number>();
      for (const c of customers) counts.set(c.company_name, (counts.get(c.company_name) ?? 0) + 1);
      for (const c of customers) {
        if (counts.get(c.company_name) === 1) customerMap.set(c.company_name, c.id);
      }
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.name?.trim()) {
      skipped += 1;
      continue;
    }
    const customerId = row.company ? customerMap.get(row.company) ?? null : null;
    const phone = row.phone?.replace(/[^0-9]/g, "") || null;

    if (row.email) {
      const { data: existing } = await supabase
        .from("respondents")
        .select("id")
        .eq("email", row.email)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("respondents")
          .update({
            name: row.name,
            phone,
            department: row.department ?? null,
            position: row.position ?? null,
            ...(customerId !== null ? { customer_id: customerId } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) {
          skipped += 1;
        } else {
          updated += 1;
        }
        continue;
      }
    }

    const { error } = await supabase.from("respondents").insert({
      name: row.name,
      email: row.email || null,
      phone,
      department: row.department ?? null,
      position: row.position ?? null,
      customer_id: customerId,
    });
    if (error) skipped += 1;
    else inserted += 1;
  }

  revalidatePath("/admin/respondents");
  return { inserted, updated, skipped };
}
