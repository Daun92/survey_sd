"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileUp, Loader2, X } from "lucide-react";
import { createTemplateFromSurvey } from "./actions";

interface Survey {
  id: string;
  title: string;
  questionCount: number;
}

export function TemplateActions({ surveys }: { surveys: Survey[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState("");
  const [templateName, setTemplateName] = useState("");

  const handleCreate = async () => {
    if (!selectedSurvey) return;
    setCreating(true);
    try {
      await createTemplateFromSurvey(selectedSurvey, templateName);
      setShowModal(false);
      setSelectedSurvey("");
      setTemplateName("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
      >
        <Plus size={16} />
        템플릿 만들기
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <FileUp size={18} className="text-teal-600" />
                설문에서 템플릿 만들기
              </h2>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">기존 설문 선택 *</label>
              <select
                value={selectedSurvey}
                onChange={(e) => setSelectedSurvey(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              >
                <option value="">설문을 선택하세요</option>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>{s.title} ({s.questionCount}문항)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">템플릿 이름</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="비워두면 설문 제목으로 자동 설정"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !selectedSurvey}
                className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                템플릿 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
