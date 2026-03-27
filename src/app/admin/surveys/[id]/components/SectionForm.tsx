"use client";

import { useState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";
import { renameSection, updateSectionIntro, deleteSection } from "../actions";
import type { SectionIntro } from "./types";

const INTRO_COLORS = [
  { value: "teal", label: "청록", className: "bg-teal-500" },
  { value: "blue", label: "파랑", className: "bg-blue-500" },
  { value: "amber", label: "노랑", className: "bg-amber-500" },
  { value: "rose", label: "빨강", className: "bg-rose-500" },
  { value: "violet", label: "보라", className: "bg-violet-500" },
] as const;

interface Props {
  surveyId: string;
  sectionName: string;
  questionCount: number;
  intro?: SectionIntro;
  onDone: () => void;
  onCancel: () => void;
}

export function SectionForm({ surveyId, sectionName, questionCount, intro, onDone, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(sectionName);
  const [introTitle, setIntroTitle] = useState(intro?.title ?? "");
  const [introDescription, setIntroDescription] = useState(intro?.description ?? "");
  const [introColor, setIntroColor] = useState<string>(intro?.color ?? "teal");

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // 이름이 변경되었으면 섹션 이름 일괄 변경
      if (name.trim() !== sectionName) {
        await renameSection(surveyId, sectionName, name.trim());
      }

      // 인터스티셜 설정 저장
      await updateSectionIntro(surveyId, name.trim(), {
        title: introTitle.trim() || undefined,
        description: introDescription.trim() || undefined,
        color: introColor,
      });

      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (questionCount > 0) {
      alert("질문이 있는 섹션은 삭제할 수 없습니다.\n먼저 질문을 다른 섹션으로 이동해 주세요.");
      return;
    }
    if (!confirm(`"${sectionName}" 섹션을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      await deleteSection(surveyId, sectionName);
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-stone-800">섹션 편집</p>

      {/* 섹션 이름 */}
      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">
          섹션 이름 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="섹션 이름"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
        />
        {name.trim() !== sectionName && name.trim() && (
          <p className="mt-1 text-[11px] text-amber-600">
            이 섹션의 모든 질문({questionCount}개)이 새 이름으로 변경됩니다
          </p>
        )}
      </div>

      {/* 인터스티셜 안내 */}
      <div className="border-t border-stone-100 pt-3">
        <p className="text-[13px] font-medium text-stone-700 mb-2">섹션 안내 페이지</p>
        <p className="text-[11px] text-stone-400 mb-2">
          설정하면 이 섹션으로 전환할 때 안내 화면이 표시됩니다
        </p>

        <div className="space-y-2">
          <div>
            <label className="block text-[11px] text-stone-500 mb-0.5">안내 제목</label>
            <input
              type="text"
              value={introTitle}
              onChange={(e) => setIntroTitle(e.target.value)}
              placeholder="예: 강사 평가"
              className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-stone-500 mb-0.5">안내 설명</label>
            <textarea
              value={introDescription}
              onChange={(e) => setIntroDescription(e.target.value)}
              placeholder="이 섹션에 대한 안내 (선택)"
              rows={3}
              className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-stone-500 mb-1">색상</label>
            <div className="flex items-center gap-2">
              {INTRO_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setIntroColor(c.value)}
                  className={`h-6 w-6 rounded-full ${c.className} transition-all ${
                    introColor === c.value
                      ? "ring-2 ring-offset-1 ring-stone-400 scale-110"
                      : "opacity-50 hover:opacity-80"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleDelete}
          disabled={deleting || questionCount > 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mr-auto"
          title={questionCount > 0 ? "질문이 있는 섹션은 삭제할 수 없습니다" : ""}
        >
          <Trash2 size={13} /> 삭제
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} 저장
        </button>
      </div>
    </div>
  );
}
