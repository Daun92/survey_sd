"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface SurveyBottomNavProps {
  onPrev?: () => void;
  onNext: () => void;
  showPrev?: boolean;
  nextLabel?: string;
  isSubmitting?: boolean;
}

export function SurveyBottomNav({
  onPrev,
  onNext,
  showPrev = true,
  nextLabel = "다음",
  isSubmitting = false,
}: SurveyBottomNavProps) {
  return (
    <nav className="fixed bottom-0 w-full z-50">
      <div
        className="border-t border-[var(--expert-surface-high)]"
        style={{
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 -12px 32px rgba(61, 59, 90, 0.06)",
        }}
      >
        <div className="flex justify-between items-center px-8 py-4 max-w-[760px] mx-auto w-full">
          {/* Previous */}
          {showPrev && onPrev ? (
            <button
              onClick={onPrev}
              className="bg-[var(--expert-surface-lowest)] border border-[var(--expert-surface-high)] text-[var(--expert-on-surface-variant)] rounded-full px-8 py-3 text-sm font-semibold hover:bg-[var(--expert-surface-low)] transition-all active:scale-[0.98] flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </button>
          ) : (
            <div />
          )}

          {/* Next / Submit */}
          <button
            onClick={onNext}
            disabled={isSubmitting}
            className="bg-[var(--expert-primary)] text-[var(--expert-on-primary)] rounded-full px-8 py-3 text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-60"
            style={{ boxShadow: "var(--expert-shadow)" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                제출 중...
              </>
            ) : (
              <>
                {nextLabel}
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
