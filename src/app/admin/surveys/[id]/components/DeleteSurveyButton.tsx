"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { deleteSurvey } from "../actions";

export function DeleteSurveyButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSurvey(surveyId);
      router.push("/admin/surveys");
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-red-500 transition-colors">
        <Trash2 size={12} /> 설문 삭제
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
      <div className="flex items-center gap-3">
        <AlertTriangle size={16} className="text-red-500 shrink-0" />
        <p className="text-xs text-red-700 flex-1">설문과 모든 문항이 영구 삭제됩니다.</p>
        <button onClick={handleDelete} disabled={deleting} className="rounded px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
          {deleting ? "..." : "삭제"}
        </button>
        <button onClick={() => setConfirming(false)} className="rounded px-2.5 py-1 text-xs font-medium text-stone-600 border border-stone-300 hover:bg-white">
          취소
        </button>
      </div>
    </div>
  );
}
