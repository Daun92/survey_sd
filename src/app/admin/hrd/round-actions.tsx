"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { createRound, updateRound, deleteRound } from "./actions";

const STATUS_FLOW: Record<string, string[]> = {
  draft: ["collecting"],
  collecting: ["closed"],
  closed: ["analyzing"],
  analyzing: ["published"],
  published: [],
};

const STATUS_LABELS: Record<string, string> = {
  draft: "준비중",
  collecting: "수집 중",
  closed: "수집 완료",
  analyzing: "분석 중",
  published: "발행 완료",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HrdRoundActions(props: any) {
  if (props.mode === "row") {
    return <RowActions roundId={props.roundId} roundStatus={props.roundStatus} roundTitle={props.roundTitle} />;
  }
  return <CreateButton />;
}

function CreateButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await createRound({
        round_number: Number(fd.get("round_number")),
        title: fd.get("title") as string,
        description: (fd.get("description") as string) || undefined,
        year: Number(fd.get("year")),
        target_count: Number(fd.get("target_count")) || 300,
        starts_at: (fd.get("starts_at") as string) || undefined,
        ends_at: (fd.get("ends_at") as string) || undefined,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
      >
        <Plus size={16} />새 라운드
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
          >
            <h2 className="text-lg font-bold text-stone-900 mb-4">
              새 실태조사 라운드
            </h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">회차</span>
                  <input
                    name="round_number"
                    type="number"
                    required
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    placeholder="22"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">연도</span>
                  <input
                    name="year"
                    type="number"
                    required
                    defaultValue={currentYear}
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-stone-600">제목</span>
                <input
                  name="title"
                  required
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  placeholder="제22회 인적자원개발 실태조사"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-stone-600">설명</span>
                <textarea
                  name="description"
                  rows={2}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-stone-600">목표 응답 수</span>
                <input
                  name="target_count"
                  type="number"
                  defaultValue={300}
                  className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">시작일</span>
                  <input
                    name="starts_at"
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">종료일</span>
                  <input
                    name="ends_at"
                    type="date"
                    className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? "생성 중..." : "생성"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function RowActions({
  roundId,
  roundStatus,
  roundTitle,
}: {
  roundId: string;
  roundStatus: string;
  roundTitle: string;
}) {
  const [loading, setLoading] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const router = useRouter();

  const nextStatuses = STATUS_FLOW[roundStatus] ?? [];

  async function handleStatusChange(newStatus: string) {
    if (!confirm(`상태를 "${STATUS_LABELS[newStatus]}"(으)로 변경하시겠습니까?`))
      return;
    setLoading(true);
    try {
      await updateRound(roundId, { status: newStatus });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
      setStatusOpen(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`"${roundTitle}" 라운드를 삭제하시겠습니까?`)) return;
    setLoading(true);
    try {
      await deleteRound(roundId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {nextStatuses.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            disabled={loading}
            className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            상태 변경 <ChevronDown size={12} />
          </button>
          {statusOpen && (
            <div className="absolute right-0 bottom-full mb-1 z-10 rounded-lg border border-stone-200 bg-white shadow-lg py-1 min-w-[120px]">
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className="block w-full text-left px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {roundStatus === "draft" && (
        <button
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex items-center rounded-md p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50"
          title="삭제"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
