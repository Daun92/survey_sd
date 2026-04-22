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

export interface ResponseHistoryRow {
  name: string;
  phone?: string;
  company?: string;
  position?: string;
  course_name?: string;
  /** YYYY-MM-01 형식 권장, 다른 형식이면 파서에서 정규화 */
  responded_month: string;
}

export interface ResponseHistoryDryRunResult {
  totalRows: number;
  skippedEmptyName: number;
  skippedInvalidMonth: number;
  distinctPeople: number;
  newPeople: number;
  existingPeople: number;
  historyToInsert: number;
  unmatchedCompanies: string[];
}

export interface ResponseHistoryImportResult extends ResponseHistoryDryRunResult {
  respondentsInserted: number;
  respondentsUpdated: number;
  historyInserted: number;
  historyDuplicatesSkipped: number;
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

// ============================================================================
// 응답이력 CSV 병합 (respondent_cs_history)
// ----------------------------------------------------------------------------
// 외부 엑셀/CSV 로 수집된 과거 설문 응답이력을 respondents 마스터와
// respondent_cs_history 에 병합한다. dedup 키는 (이름 + 정규화 전화번호).
// email 은 CSV 에 없어도 OK. last_cs_survey_sent_at 은 각 인물의
// max(responded_month) 로 동기화 (응답 ≥ 발송 이므로 6개월 룰 프록시로 사용).
// ============================================================================

/** 고객사 이름 정규화: `(주)`, `㈜`, `주식회사`, `(재)` 제거 + 공백/점 다듬기 */
function normalizeCompany(raw: string): string {
  return raw
    .replace(/\(주\)|㈜|주식회사|\(재\)|재단법인|\(사\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits || null;
}

/**
 * CSV 의 '설문시기' 값 (예: '2025-11-01', '2025-11', '2025/11') → 'YYYY-MM-01' DATE.
 * 파싱 불가 → null.
 */
function normalizeRespondedMonth(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO 'YYYY-MM-DD' or 'YYYY-MM'
  const m1 = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);
  if (m1) {
    const y = m1[1];
    const mo = m1[2].padStart(2, "0");
    return `${y}-${mo}-01`;
  }
  return null;
}

/**
 * CSV 고객사명 배열 → customers.id 매칭 맵.
 * 1) exact match (company_name == raw)
 * 2) normalized match (정규화 raw == 정규화 company_name, 단일일 때만)
 * 3) '..' 말줄임 → prefix like 매칭 (단일일 때만)
 */
async function buildCustomerMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawNames: string[],
): Promise<{ map: Map<string, number>; unmatched: string[] }> {
  const unique = [...new Set(rawNames.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return { map: new Map(), unmatched: [] };

  const map = new Map<string, number>();
  const unmatched: string[] = [];

  // 전체 customers 1회 로드 (706건 수준이므로 O(N) 매칭 비용 무시)
  const { data: all } = await supabase
    .from("customers")
    .select("id, company_name");
  const customers = all ?? [];

  // 정규화 이름 → customer id[] 맵 구축
  const byNormalized = new Map<string, number[]>();
  for (const c of customers) {
    const norm = normalizeCompany(c.company_name);
    const arr = byNormalized.get(norm) ?? [];
    arr.push(c.id);
    byNormalized.set(norm, arr);
  }

  for (const raw of unique) {
    // 1) exact
    const exact = customers.find((c) => c.company_name === raw);
    if (exact) {
      map.set(raw, exact.id);
      continue;
    }
    // 2) normalized
    const norm = normalizeCompany(raw);
    const normHits = byNormalized.get(norm);
    if (normHits && normHits.length === 1) {
      map.set(raw, normHits[0]);
      continue;
    }
    // 3) '..' 말줄임 → prefix like
    if (raw.endsWith("..")) {
      const prefix = raw.slice(0, -2);
      const likeHits = customers.filter((c) =>
        c.company_name.startsWith(prefix),
      );
      if (likeHits.length === 1) {
        map.set(raw, likeHits[0].id);
        continue;
      }
      // normalized prefix 도 시도
      const normPrefix = normalizeCompany(prefix);
      const normLike = customers.filter((c) =>
        normalizeCompany(c.company_name).startsWith(normPrefix),
      );
      if (normLike.length === 1) {
        map.set(raw, normLike[0].id);
        continue;
      }
    }
    unmatched.push(raw);
  }
  return { map, unmatched };
}

/** 테스트 행 판별: 이름/고객사/과정명에 '테스트' 들어간 경우 제외 */
function isTestRow(r: ResponseHistoryRow): boolean {
  const tokens = [r.name, r.company, r.course_name].map((s) => s ?? "");
  return tokens.some((t) => t.includes("테스트"));
}

/**
 * dry-run: 실제 insert 는 하지 않고 업로드 시 어떤 작업이 일어날지 집계만 반환.
 * UI 에서 확인 모달 → importResponseHistory 로 확정 실행하도록 분리.
 */
export async function previewResponseHistoryImport(
  rows: ResponseHistoryRow[],
): Promise<ResponseHistoryDryRunResult> {
  const supabase = await createClient();
  return computePreview(supabase, rows);
}

async function computePreview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ResponseHistoryRow[],
): Promise<ResponseHistoryDryRunResult> {
  const cleaned = rows.filter((r) => !isTestRow(r));

  let skippedEmptyName = 0;
  let skippedInvalidMonth = 0;
  const validRows: Array<ResponseHistoryRow & { phoneKey: string | null; monthIso: string }> = [];

  for (const r of cleaned) {
    if (!r.name?.trim()) {
      skippedEmptyName += 1;
      continue;
    }
    const monthIso = normalizeRespondedMonth(r.responded_month);
    if (!monthIso) {
      skippedInvalidMonth += 1;
      continue;
    }
    validRows.push({ ...r, phoneKey: normalizePhone(r.phone), monthIso });
  }

  // 인물 unique 키: 이름|전화. 전화 없으면 이름만.
  const peopleKeys = new Set<string>();
  for (const r of validRows) {
    peopleKeys.add(`${r.name.trim()}|${r.phoneKey ?? ""}`);
  }

  // 기존 인물 조회 (이름 매칭 후 전화 비교). 이름 목록으로 한번에.
  const names = [...new Set(validRows.map((r) => r.name.trim()))];
  const existingByKey = new Set<string>();
  if (names.length > 0) {
    const { data: existing } = await supabase
      .from("respondents")
      .select("name, phone")
      .in("name", names);
    for (const e of existing ?? []) {
      existingByKey.add(`${e.name}|${normalizePhone(e.phone) ?? ""}`);
    }
  }

  const newPeople = [...peopleKeys].filter((k) => !existingByKey.has(k)).length;
  const existingPeople = peopleKeys.size - newPeople;

  const { unmatched } = await buildCustomerMap(
    supabase,
    validRows.map((r) => r.company ?? "").filter(Boolean),
  );

  return {
    totalRows: rows.length,
    skippedEmptyName,
    skippedInvalidMonth,
    distinctPeople: peopleKeys.size,
    newPeople,
    existingPeople,
    historyToInsert: validRows.length,
    unmatchedCompanies: [...new Set(unmatched)],
  };
}

/**
 * 실제 실행: respondent upsert → history insert(ON CONFLICT DO NOTHING) →
 * last_cs_survey_sent_at 동기화.
 */
export async function importResponseHistory(
  rows: ResponseHistoryRow[],
): Promise<ResponseHistoryImportResult> {
  const supabase = await createClient();
  const preview = await computePreview(supabase, rows);

  const cleaned = rows.filter((r) => !isTestRow(r));
  const validRows: Array<
    ResponseHistoryRow & { phoneKey: string | null; monthIso: string }
  > = [];
  for (const r of cleaned) {
    if (!r.name?.trim()) continue;
    const monthIso = normalizeRespondedMonth(r.responded_month);
    if (!monthIso) continue;
    validRows.push({ ...r, phoneKey: normalizePhone(r.phone), monthIso });
  }

  const { map: customerMap } = await buildCustomerMap(
    supabase,
    validRows.map((r) => r.company ?? "").filter(Boolean),
  );

  // 1) 인물 upsert: (name, phone_digits) unique key in-memory
  const names = [...new Set(validRows.map((r) => r.name.trim()))];
  const { data: existingPeople } = await supabase
    .from("respondents")
    .select("id, name, phone, position, customer_id, last_cs_survey_sent_at")
    .in("name", names);

  const byKey = new Map<
    string,
    {
      id: string;
      position: string | null;
      customer_id: number | null;
      last_cs_survey_sent_at: string | null;
    }
  >();
  for (const p of existingPeople ?? []) {
    byKey.set(`${p.name}|${normalizePhone(p.phone) ?? ""}`, {
      id: p.id,
      position: p.position,
      customer_id: p.customer_id,
      last_cs_survey_sent_at: p.last_cs_survey_sent_at,
    });
  }

  let respondentsInserted = 0;
  let respondentsUpdated = 0;

  // 인물별 max(responded_month) 먼저 계산 (update 에 사용)
  const maxMonthByKey = new Map<string, string>();
  for (const r of validRows) {
    const k = `${r.name.trim()}|${r.phoneKey ?? ""}`;
    const prev = maxMonthByKey.get(k);
    if (!prev || r.monthIso > prev) maxMonthByKey.set(k, r.monthIso);
  }

  // 인물 처리
  for (const [key, maxMonth] of maxMonthByKey) {
    const [name, phoneKey] = key.split("|");
    const sample = validRows.find(
      (r) => r.name.trim() === name && (r.phoneKey ?? "") === phoneKey,
    )!;
    const customerId = sample.company
      ? customerMap.get(sample.company.trim()) ?? null
      : null;
    const position = sample.position?.trim() || null;
    const maxMonthIso = `${maxMonth}T00:00:00Z`;

    const existing = byKey.get(key);
    if (existing) {
      // 기존 인물: last_cs_survey_sent_at 은 더 최근일 때만 갱신.
      const needUpdate =
        !existing.last_cs_survey_sent_at ||
        existing.last_cs_survey_sent_at < maxMonthIso ||
        (customerId !== null && existing.customer_id !== customerId) ||
        (position !== null && existing.position !== position);

      if (needUpdate) {
        const patch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        const prevLast = existing.last_cs_survey_sent_at;
        if (!prevLast || prevLast < maxMonthIso) {
          patch.last_cs_survey_sent_at = maxMonthIso;
        }
        if (customerId !== null && existing.customer_id !== customerId) {
          patch.customer_id = customerId;
        }
        if (position !== null && existing.position !== position) {
          patch.position = position;
        }
        const { error } = await supabase
          .from("respondents")
          .update(patch)
          .eq("id", existing.id);
        if (!error) respondentsUpdated += 1;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("respondents")
        .insert({
          name,
          phone: phoneKey || null,
          position,
          customer_id: customerId,
          last_cs_survey_sent_at: maxMonthIso,
        })
        .select("id")
        .single();
      if (!error && inserted) {
        byKey.set(key, {
          id: inserted.id,
          position,
          customer_id: customerId,
          last_cs_survey_sent_at: maxMonthIso,
        });
        respondentsInserted += 1;
      }
    }
  }

  // 2) history bulk insert
  type HistoryRow = {
    respondent_id: string;
    customer_id: number | null;
    course_name: string | null;
    responded_month: string;
    source: string;
    raw_company_name: string | null;
    raw_position: string | null;
  };
  const historyRows: HistoryRow[] = [];
  for (const r of validRows) {
    const key = `${r.name.trim()}|${r.phoneKey ?? ""}`;
    const person = byKey.get(key);
    if (!person) continue;
    const customerId = r.company ? customerMap.get(r.company.trim()) ?? null : null;
    historyRows.push({
      respondent_id: person.id,
      customer_id: customerId,
      course_name: r.course_name?.trim() || null,
      responded_month: r.monthIso,
      source: "csv_import",
      raw_company_name: r.company?.trim() || null,
      raw_position: r.position?.trim() || null,
    });
  }

  // 기존 (respondent_id, course_name, responded_month) 조합 먼저 조회 → 중복 제거
  let historyDuplicatesSkipped = 0;
  let historyInserted = 0;
  if (historyRows.length > 0) {
    const respondentIds = [...new Set(historyRows.map((h) => h.respondent_id))];
    const { data: existingHist } = await supabase
      .from("respondent_cs_history")
      .select("respondent_id, course_name, responded_month")
      .in("respondent_id", respondentIds);

    const existSet = new Set<string>();
    for (const h of existingHist ?? []) {
      existSet.add(`${h.respondent_id}|${h.course_name ?? ""}|${h.responded_month}`);
    }

    const toInsert = historyRows.filter((h) => {
      const k = `${h.respondent_id}|${h.course_name ?? ""}|${h.responded_month}`;
      if (existSet.has(k)) {
        historyDuplicatesSkipped += 1;
        return false;
      }
      existSet.add(k);
      return true;
    });

    if (toInsert.length > 0) {
      // 100건씩 chunk insert
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        const { error, count } = await supabase
          .from("respondent_cs_history")
          .insert(chunk, { count: "exact" });
        if (!error) historyInserted += count ?? chunk.length;
      }
    }
  }

  revalidatePath("/admin/respondents");

  return {
    ...preview,
    respondentsInserted,
    respondentsUpdated,
    historyInserted,
    historyDuplicatesSkipped,
  };
}
