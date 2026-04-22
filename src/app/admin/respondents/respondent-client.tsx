"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertCircle,
  Upload,
  History,
} from "lucide-react";
import {
  createRespondent,
  updateRespondent,
  deleteRespondent,
  toggleRespondentActive,
  bulkImportRespondents,
  previewResponseHistoryImport,
  importResponseHistory,
  type ResponseHistoryRow,
  type ResponseHistoryDryRunResult,
} from "./actions";

interface Customer {
  id: number;
  company_name: string;
}

interface Respondent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  customer_id: number | null;
  customers: { id: number; company_name: string } | null;
  last_cs_survey_sent_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  sent_count: number;
  response_count: number;
  last_response_at: string | null;
  history_count: number;
  history_latest_month: string | null;
  history_latest_course: string | null;
}

type FilterPreset = "all" | "not_sent" | "no_recent_response" | "active_only" | "has_history";

function formatMonth(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 숫자만 저장된 전화번호를 010-1234-5678 형태로 렌더 (입력은 그대로 보존) */
function formatPhoneDisplay(raw: string | null): string {
  if (!raw) return "—";
  const d = raw.replace(/[^0-9]/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return raw;
}

/**
 * 간단 CSV 파서 — 헤더 1행 + 데이터 행. 헤더명은 한글/영문 모두 허용.
 * 매핑: name/이름, email/이메일, phone/전화, company/회사/고객사, department/부서, position/직위
 */
function parseCsv(text: string): {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  department?: string;
  position?: string;
}[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    name: header.findIndex((h) => h === "name" || h === "이름"),
    email: header.findIndex((h) => h === "email" || h === "이메일"),
    phone: header.findIndex((h) => h === "phone" || h === "전화" || h === "전화번호"),
    company: header.findIndex((h) => h === "company" || h === "회사" || h === "고객사" || h === "회사명"),
    department: header.findIndex((h) => h === "department" || h === "부서"),
    position: header.findIndex((h) => h === "position" || h === "직위"),
  };
  if (idx.name < 0) throw new Error("CSV 에 'name' 또는 '이름' 헤더가 없습니다.");

  const out: ReturnType<typeof parseCsv> = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const name = cells[idx.name]?.trim();
    if (!name) continue;
    out.push({
      name,
      email: idx.email >= 0 ? cells[idx.email]?.trim() || undefined : undefined,
      phone: idx.phone >= 0 ? cells[idx.phone]?.trim() || undefined : undefined,
      company: idx.company >= 0 ? cells[idx.company]?.trim() || undefined : undefined,
      department: idx.department >= 0 ? cells[idx.department]?.trim() || undefined : undefined,
      position: idx.position >= 0 ? cells[idx.position]?.trim() || undefined : undefined,
    });
  }
  return out;
}

/**
 * 응답이력 CSV 파서 — 과정명/고객사/이름/직급/전화번호/설문시기.
 * 헤더명은 한글 또는 영문 alias 모두 허용.
 */
function parseResponseHistoryCsv(text: string): ResponseHistoryRow[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    course: header.findIndex((h) => h === "course_name" || h === "과정명" || h === "과정"),
    company: header.findIndex((h) => h === "company" || h === "회사" || h === "고객사" || h === "회사명"),
    name: header.findIndex((h) => h === "name" || h === "이름"),
    position: header.findIndex((h) => h === "position" || h === "직위" || h === "직급"),
    phone: header.findIndex((h) => h === "phone" || h === "전화" || h === "전화번호"),
    month: header.findIndex(
      (h) =>
        h === "responded_month" ||
        h === "sent_month" ||
        h === "설문시기" ||
        h === "응답월" ||
        h === "응답시기" ||
        h === "발송월" ||
        h === "시기",
    ),
  };
  if (idx.name < 0) throw new Error("CSV 에 '이름' 헤더가 없습니다.");
  if (idx.month < 0) throw new Error("CSV 에 '설문시기' 또는 '응답월' 헤더가 없습니다.");

  const out: ResponseHistoryRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const name = cells[idx.name]?.trim();
    const responded_month = cells[idx.month]?.trim();
    if (!name || !responded_month) continue;
    out.push({
      name,
      responded_month,
      phone: idx.phone >= 0 ? cells[idx.phone]?.trim() || undefined : undefined,
      company: idx.company >= 0 ? cells[idx.company]?.trim() || undefined : undefined,
      position: idx.position >= 0 ? cells[idx.position]?.trim() || undefined : undefined,
      course_name: idx.course >= 0 ? cells[idx.course]?.trim() || undefined : undefined,
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  // 간단 CSV: 쌍따옴표 인용 지원
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  department: "",
  position: "",
  customer_id: "" as string,
  notes: "",
};

export default function RespondentClient({
  respondents,
  customers,
}: {
  respondents: Respondent[];
  customers: Customer[];
}) {
  const [search, setSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [preset, setPreset] = useState<FilterPreset>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyFileInputRef = useRef<HTMLInputElement>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPreview, setHistoryPreview] = useState<
    | {
        rows: ResponseHistoryRow[];
        result: ResponseHistoryDryRunResult;
      }
    | null
  >(null);

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

  const filtered = respondents.filter((r) => {
    const q = search.trim();
    const qDigits = q.replace(/[^0-9]/g, "");
    const phoneDigits = r.phone?.replace(/[^0-9]/g, "") ?? "";
    const matchSearch =
      !q ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.email?.toLowerCase().includes(q.toLowerCase()) ||
      r.department?.toLowerCase().includes(q.toLowerCase()) ||
      (qDigits.length >= 3 && phoneDigits.includes(qDigits));
    const matchCustomer =
      !filterCustomer || String(r.customer_id) === filterCustomer;

    let matchPreset = true;
    if (preset === "not_sent") {
      matchPreset = !r.last_cs_survey_sent_at && r.sent_count === 0;
    } else if (preset === "no_recent_response") {
      // 발송은 있었으나 90일 내 응답 없음
      const hasSent = !!r.last_cs_survey_sent_at || r.sent_count > 0;
      const lastResp = r.last_response_at ? new Date(r.last_response_at).getTime() : 0;
      const recent = Date.now() - lastResp < NINETY_DAYS_MS;
      matchPreset = hasSent && !recent;
    } else if (preset === "active_only") {
      matchPreset = r.is_active;
    } else if (preset === "has_history") {
      matchPreset = r.history_count > 0;
    }

    return matchSearch && matchCustomer && matchPreset;
  });

  const presetCounts = {
    all: respondents.length,
    not_sent: respondents.filter((r) => !r.last_cs_survey_sent_at && r.sent_count === 0).length,
    no_recent_response: respondents.filter((r) => {
      const hasSent = !!r.last_cs_survey_sent_at || r.sent_count > 0;
      const lastResp = r.last_response_at ? new Date(r.last_response_at).getTime() : 0;
      return hasSent && Date.now() - lastResp >= NINETY_DAYS_MS;
    }).length,
    active_only: respondents.filter((r) => r.is_active).length,
    has_history: respondents.filter((r) => r.history_count > 0).length,
  };

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function startEdit(r: Respondent) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      email: r.email ?? "",
      phone: r.phone ?? "",
      department: r.department ?? "",
      position: r.position ?? "",
      customer_id: r.customer_id ? String(r.customer_id) : "",
      notes: r.notes ?? "",
    });
    setShowForm(true);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const phoneDigits = form.phone.replace(/[^0-9]/g, "");
    if (!phoneDigits) {
      showToast("휴대전화는 메시지 발송용 필수 값입니다.");
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      showToast("휴대전화 형식을 확인해주세요 (숫자 10~11자리).");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        department: form.department.trim() || undefined,
        position: form.position.trim() || undefined,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        notes: form.notes.trim() || undefined,
      };
      if (editingId) {
        await updateRespondent(editingId, payload);
        showToast("응답자가 수정되었습니다.");
      } else {
        await createRespondent(payload);
        showToast("응답자가 추가되었습니다.");
      }
      resetForm();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 응답자를 삭제하시겠습니까?`)) return;
    try {
      await deleteRespondent(id);
      showToast("응답자가 삭제되었습니다.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "삭제 실패");
    }
  }

  async function handleToggleActive(id: string, current: boolean) {
    try {
      await toggleRespondentActive(id, !current);
      showToast(!current ? "활성화되었습니다." : "비활성화되었습니다.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "상태 변경 실패");
    }
  }

  function isSendable(lastSent: string | null): boolean {
    if (!lastSent) return true;
    const diff = Date.now() - new Date(lastSent).getTime();
    return diff > 180 * 24 * 60 * 60 * 1000;
  }

  async function handleHistoryFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHistoryLoading(true);
    try {
      const text = await file.text();
      const rows = parseResponseHistoryCsv(text);
      if (rows.length === 0) {
        showToast("업로드할 이력 레코드가 없습니다.");
        return;
      }
      const result = await previewResponseHistoryImport(rows);
      setHistoryPreview({ rows, result });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "응답이력 CSV 파싱 실패");
    } finally {
      setHistoryLoading(false);
      if (historyFileInputRef.current) historyFileInputRef.current.value = "";
    }
  }

  async function confirmHistoryImport() {
    if (!historyPreview) return;
    setHistoryLoading(true);
    try {
      const result = await importResponseHistory(historyPreview.rows);
      showToast(
        `이력 ${result.historyInserted}건 추가 (중복스킵 ${result.historyDuplicatesSkipped}) · 신규 인물 ${result.respondentsInserted} · 업데이트 ${result.respondentsUpdated}`,
      );
      setHistoryPreview(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "응답이력 업로드 실패");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleBulkImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        showToast("업로드할 레코드가 없습니다.");
        return;
      }
      const result = await bulkImportRespondents(rows);
      showToast(
        `주소록에 ${result.inserted}건 추가, ${result.updated}건 업데이트, ${result.skipped}건 스킵되었습니다.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "CSV 업로드 실패");
    } finally {
      setBulkLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] rounded-lg bg-stone-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* 응답이력 Dry-run Preview Modal */}
      {historyPreview && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-stone-800">응답이력 업로드 확인</h2>
            <p className="mt-1 text-sm text-stone-500">
              실제 적용 전에 다음 요약을 확인해주세요.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-stone-50 p-3">
                <dt className="text-xs text-stone-500">전체 행</dt>
                <dd className="mt-0.5 font-semibold text-stone-800">{historyPreview.result.totalRows}</dd>
              </div>
              <div className="rounded-md bg-stone-50 p-3">
                <dt className="text-xs text-stone-500">이력 insert 예정</dt>
                <dd className="mt-0.5 font-semibold text-teal-700">{historyPreview.result.historyToInsert}</dd>
              </div>
              <div className="rounded-md bg-stone-50 p-3">
                <dt className="text-xs text-stone-500">인물 (unique)</dt>
                <dd className="mt-0.5 font-semibold text-stone-800">{historyPreview.result.distinctPeople}</dd>
              </div>
              <div className="rounded-md bg-stone-50 p-3">
                <dt className="text-xs text-stone-500">신규 / 기존</dt>
                <dd className="mt-0.5 font-semibold text-stone-800">
                  <span className="text-emerald-600">{historyPreview.result.newPeople}</span>
                  {" / "}
                  <span className="text-stone-600">{historyPreview.result.existingPeople}</span>
                </dd>
              </div>
              {(historyPreview.result.skippedEmptyName > 0 ||
                historyPreview.result.skippedInvalidMonth > 0) && (
                <div className="col-span-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  스킵: 이름누락 {historyPreview.result.skippedEmptyName}건 · 시기파싱실패 {historyPreview.result.skippedInvalidMonth}건
                </div>
              )}
              {historyPreview.result.unmatchedCompanies.length > 0 && (
                <div className="col-span-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  <div className="font-medium">매칭 실패 고객사 {historyPreview.result.unmatchedCompanies.length}건</div>
                  <div className="mt-1 max-h-24 overflow-y-auto text-[11px] text-amber-700">
                    {historyPreview.result.unmatchedCompanies.slice(0, 20).join(", ")}
                    {historyPreview.result.unmatchedCompanies.length > 20 && " …"}
                  </div>
                  <div className="mt-1 text-[11px] text-amber-600">
                    이 회사들은 customer_id = null 로 저장됩니다 (raw_company_name 은 유지).
                  </div>
                </div>
              )}
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setHistoryPreview(null)}
                disabled={historyLoading}
              >
                취소
              </Button>
              <Button onClick={confirmHistoryImport} disabled={historyLoading}>
                {historyLoading ? "적용 중..." : "확정 적용"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-800">대상자 주소록</h1>
          <p className="text-sm text-stone-500 mt-1">
            메시지(SMS) 발송 중심으로 CS 설문 대상자 연락처를 관리합니다. 휴대전화가 기본 식별키이며, 이메일은 보조 채널입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => historyFileInputRef.current?.click()}
            disabled={historyLoading}
            title="과정명/고객사/이름/직급/전화번호/설문시기 컬럼을 가진 CSV"
          >
            <History size={16} className="mr-1.5" />
            {historyLoading ? "분석 중..." : "응답이력 업로드"}
          </Button>
          <input
            ref={historyFileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleHistoryFileChange}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={bulkLoading}>
            <Upload size={16} className="mr-1.5" />
            {bulkLoading ? "업로드 중..." : "CSV 업로드"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleBulkImport}
          />
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={16} className="mr-1.5" />
            연락처 추가
          </Button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "응답자 수정" : "새 응답자 추가"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 block">
                    이름 <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 block">
                    휴대전화 <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="010-1234-5678"
                    required
                    inputMode="tel"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 block">
                    이메일 <span className="text-xs font-normal text-stone-400">(보조)</span>
                  </label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@company.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 block">고객사</label>
                  <select
                    className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  >
                    <option value="">선택 안함</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 block">부서</label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="교육팀"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 block">직위</label>
                  <Input
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="대리"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1 block">메모</label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="특이사항"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "처리 중..." : editingId ? "수정" : "추가"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 전화, 이메일, 부서 검색"
              className="pl-9"
            />
          </div>
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="w-48 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">전체 고객사</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
          <div className="flex items-center text-sm text-stone-500">
            {preset === "all" ? `총 ${filtered.length}명` : `필터 ${filtered.length}/${respondents.length}명`}
          </div>
        </div>
        {/* 세그먼트 프리셋 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "all" as const, label: "전체", count: presetCounts.all },
            { key: "active_only" as const, label: "활성만", count: presetCounts.active_only },
            { key: "not_sent" as const, label: "미발송", count: presetCounts.not_sent },
            { key: "no_recent_response" as const, label: "90일 무응답", count: presetCounts.no_recent_response },
            { key: "has_history" as const, label: "응답이력 있음", count: presetCounts.has_history },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                preset === key
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {label} <span className="ml-0.5 text-stone-400">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <UserCheck size={40} className="mx-auto text-stone-300 mb-3" />
              <p className="text-sm text-stone-400">등록된 대상자가 없습니다</p>
              <p className="text-xs text-stone-400 mt-1">
                &quot;연락처 추가&quot; 또는 &quot;CSV 업로드&quot;로 주소록을 채우거나, 배부 시 자동 축적됩니다.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="px-4 py-3 text-left font-medium text-stone-600">이름 / 이메일</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">휴대전화</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">고객사</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">부서/직위</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">응답 이력</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">6개월 룰</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">상태</th>
                    <th className="px-4 py-3 text-right font-medium text-stone-600">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const sendable = isSendable(r.last_cs_survey_sent_at);
                    return (
                      <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-stone-800">{r.name}</div>
                          {r.email && (
                            <div className="text-[11px] text-stone-400 mt-0.5">{r.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-700 font-mono text-xs">
                          {formatPhoneDisplay(r.phone)}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {r.customers?.company_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {[r.department, r.position].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          <div className="text-xs">
                            <span className="text-stone-700 font-medium">발송 {r.sent_count}</span>
                            <span className="mx-1 text-stone-300">·</span>
                            <span className="text-stone-700 font-medium">응답 {r.response_count}</span>
                          </div>
                          <div className="text-[11px] text-stone-400 mt-0.5">
                            최근 응답 {formatMonth(r.last_response_at)}
                          </div>
                          {r.history_count > 0 && (
                            <div className="mt-1 text-[11px] text-teal-700">
                              과거이력 {r.history_count}회
                              {r.history_latest_month && ` · ${formatMonth(r.history_latest_month)}`}
                              {r.history_latest_course && (
                                <span className="ml-1 text-stone-500" title={r.history_latest_course}>
                                  {r.history_latest_course.length > 14
                                    ? r.history_latest_course.slice(0, 14) + "…"
                                    : r.history_latest_course}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.last_cs_survey_sent_at ? (
                            sendable ? (
                              <Badge variant="success">발송 가능</Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                <AlertCircle size={12} className="mr-1" />
                                대기
                              </Badge>
                            )
                          ) : (
                            <span className="text-stone-400 text-xs">발송 이력 없음</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(r.id, r.is_active)}
                            className="cursor-pointer"
                          >
                            {r.is_active ? (
                              <Badge variant="success">활성</Badge>
                            ) : (
                              <Badge variant="outline">비활성</Badge>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEdit(r)}
                              className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                              title="수정"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id, r.name)}
                              className="rounded-md p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                              title="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
