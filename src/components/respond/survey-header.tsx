"use client";

import { X } from "lucide-react";

interface SurveyHeaderProps {
  currentIndex: number;
  totalQuestions: number;
  showProgress?: boolean;
  onClose?: () => void;
}

export function SurveyHeader({
  currentIndex,
  totalQuestions,
  showProgress = true,
  onClose,
}: SurveyHeaderProps) {
  const progressPercent = totalQuestions > 0
    ? Math.round(((currentIndex + 1) / totalQuestions) * 100)
    : 0;

  return (
    <header className="fixed top-0 w-full z-50 bg-[var(--expert-surface-lowest)]">
      <div className="flex justify-between items-center px-6 h-16 w-full">
        {/* Logo */}
        <div className="text-2xl font-bold text-[var(--expert-primary)] flex items-center gap-1 font-headline tracking-tight">
          EXPERT
        </div>

        {/* Progress */}
        {showProgress && (
          <div className="flex flex-col items-center flex-1 max-w-md px-8">
            <span className="text-xs font-semibold text-[var(--expert-primary-accent)] mb-1 font-headline">
              {currentIndex + 1}/{totalQuestions} 질문
            </span>
            <div className="w-full h-1.5 bg-[var(--expert-surface-high)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: `linear-gradient(to right, var(--expert-primary-accent), var(--expert-primary-fixed))`,
                }}
              />
            </div>
          </div>
        )}

        {/* Close */}
        {onClose ? (
          <button
            onClick={onClose}
            className="text-[var(--expert-on-surface-variant)] hover:bg-[var(--expert-surface-low)] transition-colors p-2 rounded-full active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>
      {/* Bottom accent line */}
      <div className="bg-[var(--expert-surface-high)] h-[1px] w-full" />
    </header>
  );
}
