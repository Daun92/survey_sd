"use client";

import { useState } from "react";
import { Pencil, Save, X, Loader2 } from "lucide-react";
import { updateTemplate } from "../../actions";

interface Props {
  templateId: string;
  name: string;
  description: string;
  onUpdated: () => void;
}

export function TemplateInfoEditor({ templateId, name: initialName, description: initialDesc, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTemplate(templateId, { name, description });
      setEditing(false);
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "수정 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(initialName);
    setDescription(initialDesc);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold text-stone-800 truncate">{name}</h1>
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
        <label className="block text-[13px] font-medium text-stone-600 mb-1">템플릿 이름</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
      </div>
      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">설명</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="템플릿 설명을 입력하세요" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleSave} disabled={saving || !name.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장
        </button>
        <button onClick={handleCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
          <X size={13} /> 취소
        </button>
      </div>
    </div>
  );
}
