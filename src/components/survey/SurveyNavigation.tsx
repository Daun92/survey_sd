"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/**
 * SurveyNavigation — 이전/다음/제출 내비게이션 버튼
 *
 * /s/와 /hrd/ 폼의 85% 동일한 내비게이션 UI를 통합.
 */

interface SurveyNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isSubmitting?: boolean;
  /** 현재 위치 표시 (예: "2 / 5") */
  stepLabel?: string;
  /** 제출 버튼 텍스트 */
  submitText?: string;
  /** 다음 버튼 텍스트 */
  nextText?: string;
}

export function SurveyNavigation({
  onPrevious,
  onNext,
  isFirstStep,
  isLastStep,
  isSubmitting = false,
  stepLabel,
  submitText = "제출하기",
  nextText = "다음",
}: SurveyNavigationProps) {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-100">
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirstStep}
        className="flex items-center gap-1 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} />
        이전
      </button>

      {stepLabel && (
        <span className="text-xs text-gray-400">{stepLabel}</span>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={isSubmitting}
        className={`flex items-center gap-1 px-5 py-2 text-sm rounded-lg transition-colors ${
          isLastStep
            ? "bg-teal-600 text-white hover:bg-teal-700"
            : "bg-gray-800 text-white hover:bg-gray-900"
        } disabled:opacity-50`}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            처리 중...
          </>
        ) : isLastStep ? (
          submitText
        ) : (
          <>
            {nextText}
            <ChevronRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}
