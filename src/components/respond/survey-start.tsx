"use client";

import { ArrowRight, Clock, Lightbulb } from "lucide-react";
import { SurveyHeader } from "./survey-header";

interface SurveyStartProps {
  survey: {
    title: string;
    serviceType: string;
    surveyYear: number;
    surveyMonth: number;
  };
  customer: {
    companyName: string;
    contactName: string | null;
  };
  questionCount: number;
  onStart: () => void;
}

export function SurveyStart({
  survey,
  customer,
  questionCount,
  onStart,
}: SurveyStartProps) {
  const estimatedMinutes = Math.max(3, Math.ceil(questionCount * 0.5));

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--expert-lavender)" }}
    >
      <SurveyHeader
        currentIndex={0}
        totalSteps={questionCount}
        showProgress={false}
      />

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-6 py-24 md:py-32">
        <div className="max-w-2xl w-full flex flex-col items-center text-center">
          {/* Decorative Illustration Area */}
          <div className="mb-12 relative">
            <div
              className="absolute inset-0 blur-3xl rounded-full scale-150 opacity-20"
              style={{ backgroundColor: "var(--expert-primary-fixed)" }}
            />
            <div
              className="relative z-10 w-32 h-32 md:w-40 md:h-40 rounded-3xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, var(--expert-primary-accent), var(--expert-primary))`,
                boxShadow: "var(--expert-shadow)",
              }}
            >
              <svg
                className="w-16 h-16 md:w-20 md:h-20 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-8">
            {/* Meta Pill */}
            <div
              className="inline-flex items-center px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(255, 255, 255, 0.6)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.4)",
                boxShadow: "var(--expert-shadow)",
              }}
            >
              <Clock
                className="h-4 w-4 mr-2"
                style={{ color: "var(--expert-primary)" }}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--expert-on-surface-variant)" }}
              >
                예상 소요 시간: {estimatedMinutes}분
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-4 max-w-xl mx-auto">
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-headline font-extrabold tracking-tight leading-tight"
                style={{ color: "var(--expert-on-surface)" }}
              >
                {survey.title}
              </h1>
              <p
                className="text-lg md:text-xl leading-relaxed opacity-90"
                style={{ color: "var(--expert-on-surface-variant)" }}
              >
                {customer.companyName}
                {customer.contactName && ` ${customer.contactName}님`}의{" "}
                {survey.serviceType} 서비스에 대한 설문입니다.
                <br />
                솔직한 답변 부탁드립니다.
              </p>
            </div>

            {/* Expert Tip */}
            <div
              className="p-6 rounded-xl max-w-lg mx-auto flex items-start gap-4 text-left"
              style={{
                background: "rgba(255, 255, 255, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.6)",
                boxShadow: "var(--expert-shadow)",
              }}
            >
              <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: "rgba(71, 66, 224, 0.1)",
                }}
              >
                <Lightbulb
                  className="h-5 w-5"
                  style={{ color: "var(--expert-tertiary)" }}
                />
              </div>
              <div>
                <h4
                  className="font-headline font-bold text-sm"
                  style={{ color: "var(--expert-on-surface)" }}
                >
                  Expert Tip
                </h4>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--expert-on-surface-variant)" }}
                >
                  본 설문의 응답은 익명으로 처리되며, 서비스 품질 개선을 위한
                  데이터로 활용됩니다.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-8">
              <button
                onClick={onStart}
                className="group relative inline-flex items-center justify-center text-white px-12 py-5 rounded-lg text-lg font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95"
                style={{
                  backgroundColor: "var(--expert-primary)",
                  boxShadow: "var(--expert-shadow)",
                }}
              >
                <span className="mr-2">시작하기</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Decorative blur elements */}
      <div
        className="fixed bottom-0 right-0 w-64 h-64 -mb-32 -mr-32 rounded-full blur-3xl pointer-events-none opacity-30"
        style={{ backgroundColor: "var(--expert-primary-fixed)" }}
      />
      <div
        className="fixed top-20 left-0 w-48 h-48 -mt-24 -ml-24 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: "var(--expert-tertiary)" }}
      />
    </div>
  );
}
