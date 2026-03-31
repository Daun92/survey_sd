"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { duplicateSurvey } from "../actions";

export function DuplicateSurveyButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [duplicating, setDuplicating] = useState(false);

  const handleDuplicate = async () => {
    if (!confirm("이 설문을 복제하시겠습니까?\n문항과 설정이 복사되며 초안 상태로 생성됩니다.")) return;
    setDuplicating(true);
    try {
      const newId = await duplicateSurvey(surveyId);
      router.push(`/admin/surveys/${newId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "복제 실패");
      setDuplicating(false);
    }
  };

  return (
    <button
      onClick={handleDuplicate}
      disabled={duplicating}
      className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-teal-600 transition-colors disabled:opacity-50"
    >
      {duplicating ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
      {duplicating ? "복제 중..." : "설문 복제"}
    </button>
  );
}
