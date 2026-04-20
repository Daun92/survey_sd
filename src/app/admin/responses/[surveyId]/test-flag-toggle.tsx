"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Undo2 } from "lucide-react";
import { setSubmissionTestFlag } from "./actions";

export function TestFlagToggle({
  submissionId,
  surveyId,
  isTest,
}: {
  submissionId: string;
  surveyId: string;
  isTest: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(isTest);

  const onClick = () => {
    const next = !optimistic;
    const confirmMsg = next
      ? "이 응답을 테스트로 표시하시겠습니까?\n집계·리포트에서 자동 제외됩니다."
      : "테스트 표시를 해제하시겠습니까?\n다시 집계·리포트에 포함됩니다.";
    if (!confirm(confirmMsg)) return;
    setOptimistic(next);
    startTransition(async () => {
      try {
        await setSubmissionTestFlag(submissionId, surveyId, next);
      } catch (e) {
        setOptimistic(!next);
        alert(e instanceof Error ? e.message : "변경 실패");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={optimistic ? "테스트 표시 해제" : "테스트로 표시 (집계 제외)"}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
        optimistic
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
          : "bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
      }`}
    >
      {optimistic ? <Undo2 size={11} /> : <FlaskConical size={11} />}
      {optimistic ? "테스트 해제" : "테스트로 표시"}
    </button>
  );
}
