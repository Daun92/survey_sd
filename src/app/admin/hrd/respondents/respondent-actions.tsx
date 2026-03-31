"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Link2, Upload } from "lucide-react";
import { addRespondent, deleteRespondent, importRespondents } from "../actions";
import { ORG_TYPE_LABELS } from "@/types/hrd-survey";

interface Round {
  id: string;
  title: string;
  round_number: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RespondentActions(props: any) {
  if (props.mode === "row") {
    return <RowActions respondentId={props.respondentId} urlToken={props.urlToken} />;
  }
  return <HeaderActions rounds={props.rounds ?? []} />;
}

function HeaderActions({ rounds }: { rounds: Round[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await addRespondent({
        round_id: fd.get("round_id") as string,
        company_name: fd.get("company_name") as string,
        respondent_name: (fd.get("respondent_name") as string) || undefined,
        respondent_position: (fd.get("respondent_position") as string) || undefined,
        respondent_email: (fd.get("respondent_email") as string) || undefined,
        org_type: (fd.get("org_type") as string) || undefined,
        org_type_code: fd.get("org_type_code") ? Number(fd.get("org_type_code")) : undefined,
      });
      setAddOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const roundId = fd.get("round_id") as string;
    const file = fd.get("csv_file") as File;

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        alert("CSV 파일에 데이터가 없습니다 (헤더 + 최소 1행)");
        return;
      }

      // 첫 번째 행은 헤더: 회사명,이름,직위,이메일,조직유형
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        return {
          company_name: cols[0] || "미입력",
          respondent_name: cols[1] || undefined,
          respondent_position: cols[2] || undefined,
          respondent_email: cols[3] || undefined,
          org_type: cols[4] || undefined,
        };
      });

      const result = await importRespondents(roundId, rows);
      alert(`${result.count}명의 응답자가 등록되었습니다`);
      setCsvOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setCsvOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
      >
        <Upload size={14} />
        CSV 가져오기
      </button>
      <button
        onClick={() => setAddOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
      >
        <Plus size={16} />
        응답자 추가
      </button>

      {/* 응답자 추가 모달 */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleAdd}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
          >
            <h2 className="text-lg font-bold text-stone-900 mb-4">응답자 추가</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-stone-600">라운드</span>
                <select
                  name="round_id"
                  required
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  {rounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-stone-600">회사명 *</span>
                <input
                  name="company_name"
                  required
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">이름</span>
                  <input
                    name="respondent_name"
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">직위</span>
                  <input
                    name="respondent_position"
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-stone-600">이메일</span>
                <input
                  name="respondent_email"
                  type="email"
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-stone-600">조직유형</span>
                <select
                  name="org_type_code"
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  {Object.entries(ORG_TYPE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? "추가 중..." : "추가"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV 가져오기 모달 */}
      {csvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleCsvImport}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
          >
            <h2 className="text-lg font-bold text-stone-900 mb-4">CSV 일괄 등록</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-stone-600">라운드</span>
                <select
                  name="round_id"
                  required
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  {rounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-stone-600">CSV 파일</span>
                <input
                  name="csv_file"
                  type="file"
                  accept=".csv"
                  required
                  className="mt-1 block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100"
                />
              </label>
              <p className="text-xs text-stone-400">
                CSV 형식: 회사명,이름,직위,이메일,조직유형
              </p>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCsvOpen(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? "등록 중..." : "등록"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function RowActions({
  respondentId,
  urlToken,
}: {
  respondentId: string;
  urlToken: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleCopyLink() {
    const url = `${window.location.origin}/hrd/${urlToken}`;
    navigator.clipboard.writeText(url);
    alert("설문 링크가 복사되었습니다");
  }

  async function handleDelete() {
    if (!confirm("이 응답자를 삭제하시겠습니까?")) return;
    setLoading(true);
    try {
      await deleteRespondent(respondentId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={handleCopyLink}
        className="rounded-md p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50"
        title="링크 복사"
      >
        <Link2 size={14} />
      </button>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="rounded-md p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50"
        title="삭제"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
