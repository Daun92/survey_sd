"use client";

import { useState } from "react";
import { Pencil, Save, X, Loader2 } from "lucide-react";
import { updateSurvey } from "../actions";
import { type Survey, statusOptions, statusLabels, formatDateForInput } from "./types";

export function SurveyInfoEditor({ survey, onUpdated }: { survey: Survey; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(survey.title);
  const [status, setStatus] = useState(survey.status);
  const [startsAt, setStartsAt] = useState(formatDateForInput(survey.starts_at));
  const [endsAt, setEndsAt] = useState(formatDateForInput(survey.ends_at));
  const [description, setDescription] = useState(survey.description || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSurvey(survey.id, { title, status, starts_at: startsAt || null, ends_at: endsAt || null, description: description || null });
      setEditing(false);
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "수정 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(survey.title);
    setStatus(survey.status);
    setStartsAt(formatDateForInput(survey.starts_at));
    setEndsAt(formatDateForInput(survey.ends_at));
    setDescription(survey.description || "");
    setEditing(false);
  };

  const currentStatus = statusLabels[survey.status] ?? statusLabels.draft;

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold text-stone-800 truncate">{survey.title}</h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${currentStatus.className}`}>
            {currentStatus.label}
          </span>
        </div>
        <button onClick={() => setEditing(true)} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
          <Pencil size={12} /> 수정
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">설문 제목</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
      </div>
      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">안내사항 <span className="text-stone-400 font-normal">— 랜딩 페이지에 표시</span></label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="설문 목적, 유의사항 등을 입력하세요" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none">
            {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">시작일</label>
          <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">종료일</label>
          <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleSave} disabled={saving || !title.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장
        </button>
        <button onClick={handleCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
          <X size={13} /> 취소
        </button>
      </div>
    </div>
  );
}
