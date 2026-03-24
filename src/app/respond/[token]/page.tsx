"use client";

import { useEffect, useState, use } from "react";
import { SurveyStart } from "@/components/respond/survey-start";
import { SurveyHeader } from "@/components/respond/survey-header";
import { SurveyQuestion } from "@/components/respond/survey-question";
import { SurveyBottomNav } from "@/components/respond/survey-bottom-nav";
import { SurveyCompletion } from "@/components/respond/survey-completion";
import { AlertCircle, ClipboardList } from "lucide-react";

interface Question {
  id: number;
  order: number;
  text: string;
  type: string;
  category: string | null;
  required: boolean;
  options: string[] | null;
}

interface SurveyData {
  survey: {
    id: number;
    title: string;
    serviceType: string;
    surveyYear: number;
    surveyMonth: number;
  };
  questions: Question[];
  customer: { companyName: string; contactName: string | null };
}

type ViewStep =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "start" }
  | { kind: "question"; index: number }
  | { kind: "submitting" }
  | { kind: "done" };

export default function RespondPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [step, setStep] = useState<ViewStep>({ kind: "loading" });
  const [data, setData] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentError, setCurrentError] = useState<number | null>(null);

  // Fetch survey data
  useEffect(() => {
    fetch(`/api/respond/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setStep({
            kind: "error",
            message: json.message || "오류가 발생했습니다",
          });
          return;
        }
        setData(json);
        setStep({ kind: "start" });
      })
      .catch(() => {
        setStep({ kind: "error", message: "서버에 연결할 수 없습니다" });
      });
  }, [token]);

  // Validate current question
  function validateCurrent(questionIndex: number): boolean {
    if (!data) return false;
    const q = data.questions[questionIndex];
    if (q.required && !answers[q.id]?.trim()) {
      setCurrentError(q.id);
      return false;
    }
    setCurrentError(null);
    return true;
  }

  // Navigate next
  function goNext() {
    if (!data) return;

    if (step.kind === "start") {
      setStep({ kind: "question", index: 0 });
      return;
    }

    if (step.kind === "question") {
      // Validate current question
      if (!validateCurrent(step.index)) return;

      // Last question → submit
      if (step.index === data.questions.length - 1) {
        handleSubmit();
        return;
      }

      // Next question
      setStep({ kind: "question", index: step.index + 1 });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Navigate previous
  function goPrev() {
    if (step.kind === "question" && step.index > 0) {
      setCurrentError(null);
      setStep({ kind: "question", index: step.index - 1 });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Submit
  async function handleSubmit() {
    if (!data) return;
    setStep({ kind: "submitting" });

    try {
      const res = await fetch(`/api/respond/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers)
            .filter(([, v]) => v.trim())
            .map(([qId, value]) => ({ questionId: parseInt(qId), value })),
        }),
      });

      if (res.ok) {
        setStep({ kind: "done" });
      } else {
        const err = await res.json();
        setStep({
          kind: "error",
          message: err.error || "제출 중 오류가 발생했습니다",
        });
      }
    } catch {
      setStep({ kind: "error", message: "서버에 연결할 수 없습니다" });
    }
  }

  // ─── Loading ───
  if (step.kind === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--expert-bg)" }}
      >
        <div className="text-center space-y-3">
          <ClipboardList
            className="mx-auto h-8 w-8 animate-pulse"
            style={{ color: "var(--expert-on-surface-variant)" }}
          />
          <p style={{ color: "var(--expert-on-surface-variant)" }}>
            설문을 불러오는 중...
          </p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (step.kind === "error") {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ backgroundColor: "var(--expert-bg)" }}
      >
        <div
          className="max-w-md w-full py-12 px-8 text-center space-y-4 rounded-xl"
          style={{
            backgroundColor: "var(--expert-surface-lowest)",
            boxShadow: "var(--expert-shadow)",
          }}
        >
          <AlertCircle
            className="mx-auto h-12 w-12"
            style={{ color: "var(--expert-on-surface-variant)" }}
          />
          <p
            className="text-lg font-medium font-headline"
            style={{ color: "var(--expert-on-surface)" }}
          >
            {step.message}
          </p>
          <p
            className="text-sm"
            style={{ color: "var(--expert-on-surface-variant)" }}
          >
            문의사항이 있으시면 담당자에게 연락해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // ─── Start ───
  if (step.kind === "start" && data) {
    return (
      <SurveyStart
        survey={data.survey}
        customer={data.customer}
        questionCount={data.questions.length}
        onStart={goNext}
      />
    );
  }

  // ─── Completion ───
  if (step.kind === "done") {
    return <SurveyCompletion />;
  }

  // ─── Question / Submitting ───
  if ((step.kind === "question" || step.kind === "submitting") && data) {
    const questionIndex =
      step.kind === "question"
        ? step.index
        : data.questions.length - 1;
    const question = data.questions[questionIndex];
    const isLast = questionIndex === data.questions.length - 1;
    const isSubmitting = step.kind === "submitting";

    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ backgroundColor: "var(--expert-bg)" }}
      >
        <SurveyHeader
          currentIndex={questionIndex}
          totalQuestions={data.questions.length}
        />

        {/* Main Content */}
        <main className="flex-grow pt-24 pb-32 px-6 max-w-[760px] mx-auto w-full">
          <SurveyQuestion
            question={question}
            value={answers[question.id] || ""}
            onChange={(v) => {
              setAnswers({ ...answers, [question.id]: v });
              if (currentError === question.id) {
                setCurrentError(null);
              }
            }}
            index={questionIndex}
            total={data.questions.length}
            hasError={currentError === question.id}
          />
        </main>

        {/* Background Decorative Elements */}
        <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-20 overflow-hidden">
          <div
            className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]"
            style={{
              background: `linear-gradient(to bottom right, var(--expert-primary-fixed), transparent)`,
            }}
          />
          <div
            className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]"
            style={{
              background: `linear-gradient(to top right, rgba(93, 91, 124, 0.3), transparent)`,
            }}
          />
        </div>

        <SurveyBottomNav
          onPrev={questionIndex > 0 ? goPrev : undefined}
          onNext={goNext}
          showPrev={questionIndex > 0}
          nextLabel={isLast ? "제출하기" : "다음"}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  return null;
}
