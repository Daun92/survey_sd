/**
 * Sprint B PR-1 — 옛 Prisma 데이터 백업 export.
 * customers, service_types 를 CSV + JSON 으로 떨군 뒤 SHA-256 hash 출력.
 *
 * 출력 파일은 ./tmp-prisma-archive/ 에 생성. .gitignore 권장.
 * 사용자가 외부 저장소(Google Drive 등) 로 옮긴 뒤 이 디렉터리는 삭제.
 *
 * 실행: npx tsx scripts/sprint-b-export-prisma.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const OUT_DIR = resolve(process.cwd(), "tmp-prisma-archive");
mkdirSync(OUT_DIR, { recursive: true });

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const head = columns.join(",");
  const body = rows
    .map((r) => columns.map((c) => csvEscape(r[c])).join(","))
    .join("\n");
  return `${head}\n${body}\n`;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

async function dumpTable(table: string, columns: string[]) {
  const { data, error } = await sb.from(table).select(columns.join(","));
  if (error) throw new Error(`${table}: ${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];
  const csv = rowsToCsv(rows, columns);
  const json = JSON.stringify(rows, null, 2) + "\n";
  const csvPath = resolve(OUT_DIR, `${table}.csv`);
  const jsonPath = resolve(OUT_DIR, `${table}.json`);
  writeFileSync(csvPath, csv, "utf8");
  writeFileSync(jsonPath, json, "utf8");
  return {
    table,
    rows: rows.length,
    csvHash: sha256(csv),
    jsonHash: sha256(json),
    csvBytes: Buffer.byteLength(csv, "utf8"),
    jsonBytes: Buffer.byteLength(json, "utf8"),
  };
}

const TABLES: Record<string, string[]> = {
  service_types: ["id", "name", "name_en", "is_active", "created_at"],
  customers: [
    "id",
    "company_name",
    "contact_name",
    "contact_title",
    "email",
    "phone",
    "service_type_id",
    "sales_rep",
    "sales_team",
    "eco_score",
    "is_active",
    "notes",
    "created_at",
    "updated_at",
  ],
  // 빈 테이블도 schema 박제 차원에서 같이 (header 만 남음)
  training_records: [
    "id",
    "customer_id",
    "training_year",
    "training_month",
    "service_type_id",
    "has_training",
    "training_name",
    "verified_by",
    "verified_at",
    "notes",
  ],
  interviews: [
    "id",
    "survey_id",
    "customer_id",
    "interview_date",
    "interviewer",
    "interview_type",
    "service_type_id",
    "satisfaction_pct",
    "summary",
    "voc_positive",
    "voc_negative",
    "audio_file_path",
    "document_path",
    "created_at",
  ],
  surveys: [
    "id",
    "title",
    "service_type_id",
    "survey_year",
    "survey_month",
    "training_month",
    "show_project_name",
    "internal_label",
    "status",
    "description",
    "created_at",
    "updated_at",
  ],
  survey_questions: [
    "id",
    "survey_id",
    "question_order",
    "question_text",
    "question_type",
    "category",
    "options_json",
    "is_required",
  ],
  question_templates: [
    "id",
    "service_type_id",
    "template_name",
    "questions_json",
    "is_default",
    "created_at",
  ],
  responses: [
    "id",
    "distribution_id",
    "survey_id",
    "customer_id",
    "responded_at",
    "is_complete",
    "source",
  ],
  response_answers: [
    "id",
    "response_id",
    "question_id",
    "answer_value",
    "answer_numeric",
    "created_at",
  ],
  monthly_reports: [
    "id",
    "report_year",
    "report_month",
    "title",
    "status",
    "overall_score",
    "scores_json",
    "voc_summary",
    "file_path",
    "created_at",
    "updated_at",
  ],
  import_logs: [
    "id",
    "file_name",
    "file_path",
    "import_type",
    "records_total",
    "records_success",
    "records_failed",
    "errors_json",
    "imported_at",
  ],
};

async function main() {
  const exportedAt = new Date().toISOString();
  const results = [] as Awaited<ReturnType<typeof dumpTable>>[];

  for (const [table, cols] of Object.entries(TABLES)) {
    const r = await dumpTable(table, cols);
    results.push(r);
    console.log(
      `  ${table.padEnd(20)} ${String(r.rows).padStart(6)} rows  ` +
        `csv ${r.csvBytes}B  json ${r.jsonBytes}B`
    );
  }

  // 집약 메타데이터
  const meta = {
    exportedAt,
    sourceDatabase: "Supabase (cs-survey, ref gdwhbacuzhynvegkfoga)",
    purpose:
      "Sprint B Scenario A — Prisma 인프라 폐기 전 잔존 데이터 영구 박제. " +
      "외부 저장소(Google Drive 등) 로 이동 후 tmp-prisma-archive/ 디렉터리 삭제.",
    tables: results,
    totalRows: results.reduce((s, r) => s + r.rows, 0),
  };
  const metaText = JSON.stringify(meta, null, 2) + "\n";
  writeFileSync(resolve(OUT_DIR, "_meta.json"), metaText, "utf8");

  console.log("\n총", meta.totalRows, "rows export 완료");
  console.log("출력 디렉터리:", OUT_DIR);
  console.log("\n--- SHA-256 hashes (git 박제용) ---");
  results.forEach((r) => {
    console.log(`  ${r.table}.csv`.padEnd(28), r.csvHash);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
