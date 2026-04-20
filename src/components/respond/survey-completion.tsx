"use client";

import { CheckCircle2, Shield, TrendingUp } from "lucide-react";
import { SurveyHeader } from "./survey-header";

interface SurveyCompletionProps {
  /** 표시할 설문 제목 (상단 헤더 오버레이) */
  surveyTitle?: string;
  /** 기본 감사 문구 대신 노출할 커스텀 텍스트 */
  customThankYou?: string;
}

export function SurveyCompletion({
  surveyTitle,
  customThankYou,
}: SurveyCompletionProps = {}) {

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--expert-surface-low)" }}
    >
      <SurveyHeader
        currentIndex={0}
        totalSteps={0}
        showProgress={false}
      />

      <main className="flex-grow flex items-center justify-center px-6 py-12 pt-24">
        <div className="max-w-[640px] w-full text-center space-y-10">
          {/* Success Icon */}
          <div className="relative inline-block">
            <div
              className="absolute inset-0 blur-3xl rounded-full scale-150 opacity-20"
              style={{ backgroundColor: "var(--expert-primary-fixed)" }}
            />
            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-white"
              style={{
                backgroundColor: "var(--expert-primary-container)",
                boxShadow: "var(--expert-shadow)",
              }}
            >
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {surveyTitle && (
              <p
                className="text-sm font-medium uppercase tracking-widest"
                style={{ color: "var(--expert-primary-accent)" }}
              >
                {surveyTitle}
              </p>
            )}
            <h2
              className="font-headline text-4xl md:text-5xl font-bold tracking-tight leading-tight"
              style={{ color: "var(--expert-on-surface)" }}
            >
              설문이 완료되었습니다!
            </h2>
            <p
              className="text-lg max-w-[480px] mx-auto leading-relaxed"
              style={{ color: "var(--expert-on-surface-variant)" }}
            >
              {customThankYou ??
                "소중한 의견 감사드립니다. 여러분의 답변은 향후 서비스 개선에 큰 도움이 됩니다."}
            </p>
          </div>


          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 text-left">
            <div
              className="p-6 rounded-xl"
              style={{
                backgroundColor: "var(--expert-surface-lowest)",
                boxShadow: "var(--expert-shadow)",
                border: "1px solid rgba(188, 202, 189, 0.1)",
              }}
            >
              <Shield
                className="h-6 w-6 mb-3"
                style={{ color: "var(--expert-primary)" }}
              />
              <h4
                className="font-headline font-semibold mb-1"
                style={{ color: "var(--expert-on-surface)" }}
              >
                응답 저장됨
              </h4>
              <p
                className="text-sm"
                style={{ color: "var(--expert-on-surface-variant)" }}
              >
                답변이 익명으로 안전하게 시스템에 제출되었습니다.
              </p>
            </div>
            <div
              className="p-6 rounded-xl"
              style={{
                backgroundColor: "var(--expert-surface-lowest)",
                boxShadow: "var(--expert-shadow)",
                border: "1px solid rgba(188, 202, 189, 0.1)",
              }}
            >
              <TrendingUp
                className="h-6 w-6 mb-3"
                style={{ color: "var(--expert-tertiary)" }}
              />
              <h4
                className="font-headline font-semibold mb-1"
                style={{ color: "var(--expert-on-surface)" }}
              >
                인사이트 반영
              </h4>
              <p
                className="text-sm"
                style={{ color: "var(--expert-on-surface-variant)" }}
              >
                전문가 그룹의 분석을 거쳐 다음 과정에 반영됩니다.
              </p>
            </div>
          </div>

          {/* Action */}
          <div className="pt-8">
            <button
              onClick={() => window.close()}
              className="text-white font-headline font-bold text-lg px-12 py-4 rounded-lg hover:opacity-95 transition-all active:scale-95"
              style={{
                backgroundColor: "var(--expert-primary)",
                boxShadow: "var(--expert-shadow)",
              }}
            >
              홈으로 이동
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 px-6">
        <div className="max-w-[760px] mx-auto flex flex-col items-center justify-center space-y-4">
          <div
            className="h-[1px] w-12"
            style={{ backgroundColor: "rgba(188, 202, 189, 0.3)" }}
          />
          <p
            className="text-xs uppercase tracking-widest opacity-60"
            style={{ color: "var(--expert-on-surface-variant)" }}
          >
            The Expert Intelligence Framework
          </p>
        </div>
      </footer>
    </div>
  );
}
