"use client";

import { useState, useTransition } from "react";
import { FlaskConical, MoreVertical, Undo2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const onToggle = () => {
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
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label="응답 작업"
        className="inline-flex items-center justify-center rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
      >
        <MoreVertical size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem
          onClick={onToggle}
          className={
            optimistic
              ? "text-amber-700 focus:text-amber-800"
              : "text-stone-700"
          }
        >
          {optimistic ? (
            <Undo2 className="text-amber-600" />
          ) : (
            <FlaskConical className="text-stone-500" />
          )}
          <div className="flex flex-col">
            <span className="text-sm">
              {optimistic ? "테스트 해제" : "테스트로 표시"}
            </span>
            <span className="text-[11px] text-stone-400">
              {optimistic ? "집계·리포트에 다시 포함" : "집계·리포트에서 제외"}
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
