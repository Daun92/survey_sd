"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { updateSession } from "./actions";

interface Session {
  id: string;
  session_number: number;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  capacity: number | null;
  status: string;
}

interface Props {
  session: Session;
  projectId: string;
}

const sessionStatusOptions = [
  { value: "scheduled", label: "예정" },
  { value: "in_progress", label: "진행중" },
  { value: "completed", label: "완료" },
  { value: "cancelled", label: "취소" },
];

export function SessionEditor({ session, projectId }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(session.name || "");
  const [startDate, setStartDate] = useState(session.start_date?.slice(0, 10) || "");
  const [endDate, setEndDate] = useState(session.end_date?.slice(0, 10) || "");
  const [capacity, setCapacity] = useState(session.capacity ?? "");
  const [status, setStatus] = useState(session.status || "scheduled");

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSession(session.id, projectId, {
        name: name.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        capacity: capacity ? Number(capacity) : null,
        status,
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "수정 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(session.name || "");
    setStartDate(session.start_date?.slice(0, 10) || "");
    setEndDate(session.end_date?.slice(0, 10) || "");
    setCapacity(session.capacity ?? "");
    setStatus(session.status || "scheduled");
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded p-0.5 text-stone-400 hover:text-teal-600 hover:bg-teal-50 opacity-0 group-hover:opacity-100 transition-all"
        title="세션 수정"
      >
        <Pencil size={12} />
      </button>
    );
  }

  return (
    <div className="col-span-full px-5 py-3 bg-teal-50/30 border-b border-teal-200">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div>
          <label className="block text-[11px] text-stone-500 mb-0.5">세션명</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`세션 ${session.session_number}`}
            className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-0.5">시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-0.5">종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-0.5">정원</label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value ? Number(e.target.value) : "")}
            placeholder="0"
            min={0}
            className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-0.5">상태</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
          >
            {sessionStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-1.5 mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} 저장
        </button>
        <button
          onClick={handleCancel}
          className="inline-flex items-center gap-1 rounded border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          <X size={11} /> 취소
        </button>
      </div>
    </div>
  );
}
