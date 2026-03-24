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
      className="min-h-screen"
      style={{ backgroundColor: "var(--expert-lavender)" }}
    >
      <SurveyHeader
        currentIndex={0}
        totalSteps={questionCount}
        showProgress={false}
      />

      {/* Main Content */}
      <main className="px-6 pt-20 pb-12">
        <div className="max-w-xl w-full mx-auto flex flex-col items-center text-center space-y-6">
          {/* Meta Pill */}
          <div
            className="inline-flex items-center px-4 py-1.5 rounded-full"
            style={{
              background: "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255, 255, 255, 0.4)",
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
          <h1
            className="text-3xl md:text-4xl font-headline font-extrabold tracking-tight leading-tight"
            style={{ color: "var(--expert-on-surface)" }}
          >
            {survey.title}
          </h1>
          <p
            className="text-base md:text-lg leading-relaxed"
            style={{ color: "var(--expert-on-surface-variant)" }}
          >
            {customer.companyName}
            {customer.contactName && ` ${customer.contactName}님`}의{" "}
            {survey.serviceType} 서비스에 대한 설문입니다.
            <br />
            솔직한 답변 부탁드립니다.
          </p>

          {/* Expert Tip */}
          <div
            className="p-5 rounded-xl w-full max-w-md flex items-start gap-3 text-left"
            style={{
              background: "rgba(255, 255, 255, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.6)",
            }}
          >
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(71, 66, 224, 0.1)" }}>
              <Lightbulb className="h-5 w-5" style={{ color: "var(--expert-tertiary)" }} />
            </div>
            <div>
              <h4 className="font-headline font-bold text-sm" style={{ color: "var(--expert-on-surface)" }}>
                Expert Tip
              </h4>
              <p className="text-sm mt-1" style={{ color: "var(--expert-on-surface-variant)" }}>
                본 설문의 응답은 익명으로 처리되며, 서비스 품질 개선을 위한 데이터로 활용됩니다.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={onStart}
            className="group inline-flex items-center justify-center px-10 py-4 rounded-lg text-lg font-bold transition-all duration-300 hover:scale-[1.02] active:scale-95 text-white shadow-lg"
            style={{ backgroundColor: "#006a3c" }}
          >
            <span className="mr-2">시작하기</span>
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </main>
    </div>
  );
}
