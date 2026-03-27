"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil } from "lucide-react";
import { addPart, deletePart, addItem, updateItem, deleteItem } from "./actions";
import type { HrdAnswerType } from "@/types/hrd-survey";

const ANSWER_TYPES: { value: HrdAnswerType; label: string }[] = [
  { value: "text", label: "텍스트" },
  { value: "number", label: "숫자" },
  { value: "percent", label: "백분율 (%)" },
  { value: "currency", label: "금액 (원)" },
  { value: "single_choice", label: "단일 선택" },
  { value: "multiple_choice", label: "복수 선택" },
  { value: "likert_5", label: "리커트 5점" },
  { value: "likert_importance_performance", label: "중요도-실행도" },
  { value: "rank_order", label: "순위" },
  { value: "comma_separated", label: "쉼표 구분" },
  { value: "year_month", label: "연월" },
  { value: "email", label: "이메일" },
  { value: "phone", label: "전화번호" },
  { value: "date", label: "날짜" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DesignActions(props: any) {
  if (props.mode === "header") return <AddPartButton rounds={props.rounds ?? []} />;
  if (props.mode === "part") return <PartRowActions partId={props.partId} partName={props.partName} />;
  if (props.mode === "item") return <ItemRowActions itemId={props.itemId} />;
  if (props.mode === "add-item")
    return (
      <AddItemButton
        partId={props.partId}
        roundId={props.roundId}
        existingItems={props.allItems ?? []}
      />
    );
  return null;
}

function AddPartButton({ rounds }: { rounds: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await addPart({
        round_id: fd.get("round_id") as string,
        part_code: fd.get("part_code") as string,
        part_name: fd.get("part_name") as string,
        description: (fd.get("description") as string) || undefined,
        sort_order: Number(fd.get("sort_order")) || 0,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
      >
        <Plus size={16} />
        파트 추가
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold text-stone-900 mb-4">새 파트 추가</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-stone-600">라운드</span>
                <select name="round_id" required className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
                  <option value="">선택</option>
                  {rounds.map((r) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">파트 코드</span>
                  <input name="part_code" required className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="p1" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">정렬 순서</span>
                  <input name="sort_order" type="number" defaultValue={0} className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-stone-600">파트 이름</span>
                <input name="part_name" required className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="I. 교육관련 지표" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-stone-600">설명</span>
                <textarea name="description" rows={2} className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">취소</button>
              <button type="submit" disabled={loading} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
                {loading ? "추가 중..." : "추가"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function PartRowActions({ partId, partName }: { partId: string; partName: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`"${partName}" 파트를 삭제하시겠습니까? 포함된 문항도 모두 삭제됩니다.`)) return;
    setLoading(true);
    try {
      await deletePart(partId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-md p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50"
      title="파트 삭제"
    >
      <Trash2 size={14} />
    </button>
  );
}

function AddItemButton({
  partId,
  roundId,
  existingItems,
}: {
  partId: string;
  roundId: string;
  existingItems: { id: string; item_code: string; question_text: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCondition, setShowCondition] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    const conditionalLogic = showCondition
      ? {
          show_if: {
            item_code: fd.get("cond_item_code") as string,
            operator: fd.get("cond_operator") as "eq" | "neq" | "gt" | "lt" | "in" | "not_in",
            value: fd.get("cond_value") as string,
          },
        }
      : undefined;

    try {
      await addItem({
        part_id: partId,
        round_id: roundId,
        item_code: fd.get("item_code") as string,
        question_text: fd.get("question_text") as string,
        answer_type: fd.get("answer_type") as HrdAnswerType,
        is_required: fd.get("is_required") === "true",
        sort_order: Number(fd.get("sort_order")) || 0,
        placeholder: (fd.get("placeholder") as string) || undefined,
        unit: (fd.get("unit") as string) || undefined,
        help_text: (fd.get("help_text") as string) || undefined,
        conditional_logic: conditionalLogic,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        <Plus size={12} />
        문항 추가
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
          <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg my-auto">
            <h2 className="text-lg font-bold text-stone-900 mb-4">문항 추가</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">문항 코드</span>
                  <input name="item_code" required className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="Q1-1" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">정렬</span>
                  <input name="sort_order" type="number" defaultValue={0} className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">필수</span>
                  <select name="is_required" className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
                    <option value="true">필수</option>
                    <option value="false">선택</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-stone-600">질문 텍스트</span>
                <textarea name="question_text" required rows={2} className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-stone-600">응답 유형</span>
                <select name="answer_type" required className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
                  {ANSWER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">플레이스홀더</span>
                  <input name="placeholder" className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-stone-600">단위</span>
                  <input name="unit" className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="명, 원, %" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-stone-600">도움말</span>
                <input name="help_text" className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
              </label>

              {/* 조건부 로직 */}
              <div className="border-t border-stone-100 pt-3">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={showCondition}
                    onChange={(e) => setShowCondition(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  조건부 표시 설정
                </label>

                {showCondition && (
                  <div className="mt-2 space-y-2 rounded-lg bg-stone-50 p-3">
                    <label className="block">
                      <span className="text-xs font-medium text-stone-600">기준 문항 코드</span>
                      <select name="cond_item_code" required className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white">
                        <option value="">선택</option>
                        {existingItems.map((item) => (
                          <option key={item.id} value={item.item_code}>
                            {item.item_code} - {item.question_text.slice(0, 40)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs font-medium text-stone-600">연산자</span>
                        <select name="cond_operator" className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white">
                          <option value="eq">같음 (eq)</option>
                          <option value="neq">다름 (neq)</option>
                          <option value="gt">초과 (gt)</option>
                          <option value="lt">미만 (lt)</option>
                          <option value="in">포함 (in)</option>
                          <option value="not_in">미포함 (not_in)</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-stone-600">비교 값</span>
                        <input name="cond_value" className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="1 또는 1,2,3" />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">취소</button>
              <button type="submit" disabled={loading} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
                {loading ? "추가 중..." : "추가"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function ItemRowActions({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("이 문항을 삭제하시겠습니까?")) return;
    setLoading(true);
    try {
      await deleteItem(itemId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-md p-0.5 text-stone-300 hover:text-rose-600 hover:bg-rose-50"
      title="삭제"
    >
      <Trash2 size={12} />
    </button>
  );
}
