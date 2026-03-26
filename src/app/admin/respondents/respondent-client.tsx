"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  UserCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  createRespondent,
  updateRespondent,
  deleteRespondent,
  toggleRespondentActive,
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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = respondents.filter((r) => {
    const matchSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.department?.toLowerCase().includes(search.toLowerCase());
    const matchCustomer =
      !filterCustomer || String(r.customer_id) === filterCustomer;
    return matchSearch && matchCustomer;
  });

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

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999] rounded-lg bg-stone-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-800">응답자 관리</h1>
          <p className="text-sm text-stone-500 mt-1">
            설문 대상 응답자를 등록하고 관리합니다
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={16} className="mr-1.5" />
          응답자 추가
        </Button>
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
                  <label className="text-sm font-medium text-stone-700 mb-1 block">이메일</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@company.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 block">전화번호</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="010-1234-5678"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 block">고객사</label>
                  <Select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  >
                    <option value="">선택 안함</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </Select>
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
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 이메일, 부서 검색"
            className="pl-9"
          />
        </div>
        <Select
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          className="w-48"
        >
          <option value="">전체 고객사</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </Select>
        <div className="flex items-center text-sm text-stone-500">
          총 {filtered.length}명
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <UserCheck size={40} className="mx-auto text-stone-300 mb-3" />
              <p className="text-sm text-stone-400">등록된 응답자가 없습니다</p>
              <p className="text-xs text-stone-400 mt-1">
                &quot;응답자 추가&quot; 버튼으로 응답자를 등록하세요
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="px-4 py-3 text-left font-medium text-stone-600">이름</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">이메일</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">고객사</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">부서/직위</th>
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
                        <td className="px-4 py-3 font-medium text-stone-800">{r.name}</td>
                        <td className="px-4 py-3 text-stone-600">{r.email || "—"}</td>
                        <td className="px-4 py-3 text-stone-600">
                          {r.customers?.company_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {[r.department, r.position].filter(Boolean).join(" / ") || "—"}
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
