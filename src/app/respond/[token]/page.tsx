"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import { SurveyStart } from "@/components/respond/survey-start";
import { SurveyHeader } from "@/components/respond/survey-header";
import { SurveyQuestion } from "@/components/respond/survey-question";
import { SurveyBottomNav } from "@/components/respond/survey-bottom-nav";
import { SurveyCompletion } from "@/components/respond/survey-completion";
import { RespondentErrorState } from "@/components/respond/respondent-error-state";
import { ClipboardList } from "lucide-react";
import { useSurveyDraft } from "@/hooks/useSurveyDraft";

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
    description?: string | null;
    serviceType: string;
    surveyYear: number;
    surveyMonth: number;
  };
  questions: Question[];
  customer: { companyName: string; contactName: string | null };
}

interface CategoryGroup {
  category: string;
  questions: Question[];
}

type ViewStep =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "start" }
  | { kind: "category"; index: number }
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
  const [answers, setAnswers, clearDraft] = useSurveyDraft<Record<number, string>>(
    `respond-draft-${token}`,
    {},
  );
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // 카테고리별 그룹핑
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    if (!data) return [];
    const groups: CategoryGroup[] = [];
    let current: CategoryGroup | null = null;

    for (const q of data.questions) {
      const cat = q.category || "기타";
      if (!current || current.category !== cat) {
        current = { category: cat, questions: [] };
        groups.push(current);
      }
      current.questions.push(q);
    }
    return groups;
  }, [data]);

  // Fetch survey data
  useEffect(() => {
    fetch(`/api/respond/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setStep({ kind: "error", message: json.message || "오류가 발생했습니다" });
          return;
        }
        setData(json);
        setStep({ kind: "start" });
      })
      .catch(() => {
        setStep({ kind: "error", message: "서버에 연결할 수 없습니다" });
      });
  }, [token]);

  // 현재 카테고리의 필수 문항 검증
  function validateCategory(catIndex: number): boolean {
    const group = categoryGroups[catIndex];
    if (!group) return true;
    const newErrors = new Set<number>();
    for (const q of group.questions) {
      if (q.required && !answers[q.id]?.trim()) {
        newErrors.add(q.id);
      }
    }
    setErrors(newErrors);
    if (newErrors.size > 0) {
      // 첫 에러 문항으로 스크롤
      setTimeout(() => {
        document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
    return newErrors.size === 0;
  }

  function goNext() {
    if (step.kind === "start") {
      if (startedAtRef.current === null) startedAtRef.current = Date.now();
      setStep({ kind: "category", index: 0 });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step.kind === "category") {
      if (!validateCategory(step.index)) return;
      if (step.index === categoryGroups.length - 1) {
        handleSubmit();
        return;
      }
      setErrors(new Set());
      setStep({ kind: "category", index: step.index + 1 });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goPrev() {
    if (step.kind === "category" && step.index > 0) {
      setErrors(new Set());
      setStep({ kind: "category", index: step.index - 1 });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

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
        if (startedAtRef.current !== null) {
          setElapsedSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
        }
        clearDraft();
        setStep({ kind: "done" });
      } else {
        const err = await res.json();
        setStep({ kind: "error", message: err.error || "제출 중 오류가 발생했습니다" });
      }
    } catch {
      setStep({ kind: "error", message: "서버에 연결할 수 없습니다" });
    }
  }

  // ─── Loading ───
  if (step.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--expert-bg)" }}>
        <div className="text-center space-y-3">
          <ClipboardList className="mx-auto h-8 w-8 animate-pulse" style={{ color: "var(--expert-on-surface-variant)" }} />
          <p style={{ color: "var(--expert-on-surface-variant)" }}>설문을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (step.kind === "error") {
    // 서버 응답 메시지로 variant 추정
    const msg = step.message;
    const variant: "submitted" | "expired" | "invalid" | "server_error" =
      /이미 응답|already/i.test(msg) ? "submitted"
      : /종료|마감|expired|closed/i.test(msg) ? "expired"
      : /찾을 수 없|invalid|not found/i.test(msg) ? "invalid"
      : /서버|네트워크|연결/i.test(msg) ? "server_error"
      : "invalid";
    return <RespondentErrorState variant={variant} description={msg} />;
  }

  // ─── Start ───
  if (step.kind === "start" && data) {
    return (
      <SurveyStart
        survey={data.survey}
        questionCount={data.questions.length}
        onStart={goNext}
      />
    );
  }

  // ─── Completion ───
  if (step.kind === "done") {
    const answered = Object.values(answers).filter((v) => v.trim()).length;
    return (
      <SurveyCompletion
        surveyTitle={data?.survey.title}
        answeredCount={answered}
        elapsedSeconds={elapsedSeconds}
      />
    );
  }

  // ─── Category View (multiple questions) ───
  if ((step.kind === "category" || step.kind === "submitting") && data) {
    const catIndex = step.kind === "category" ? step.index : categoryGroups.length - 1;
    const group = categoryGroups[catIndex];
    const isLast = catIndex === categoryGroups.length - 1;
    const isSubmitting = step.kind === "submitting";

    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--expert-bg)" }}>
        <SurveyHeader
          currentIndex={catIndex}
          totalSteps={categoryGroups.length}
          categoryName={group.category}
        />

        <main className="flex-grow pt-24 pb-32 px-6 max-w-[760px] mx-auto w-full">
          {/* 카테고리 제목 */}
          <div className="mb-10">
            <span
              className="font-headline text-sm font-semibold uppercase tracking-widest"
              style={{ color: "var(--expert-primary-accent)" }}
            >
              {group.category}
            </span>
            <div className="mt-2 h-[2px] w-12 rounded-full" style={{ backgroundColor: "var(--expert-primary-accent)" }} />
          </div>

          {/* 문항 목록 */}
          <div className="space-y-12">
            {group.questions.map((question, qIdx) => {
              // 전체 문항 중 인덱스 계산
              const globalIndex = categoryGroups
                .slice(0, catIndex)
                .reduce((sum, g) => sum + g.questions.length, 0) + qIdx;

              return (
                <div
                  key={question.id}
                  {...(errors.has(question.id) ? { "data-error": true } : {})}
                >
                  <SurveyQuestion
                    question={question}
                    value={answers[question.id] || ""}
                    onChange={(v) => {
                      setAnswers({ ...answers, [question.id]: v });
                      if (errors.has(question.id)) {
                        const next = new Set(errors);
                        next.delete(question.id);
                        setErrors(next);
                      }
                    }}
                    index={globalIndex}
                    total={data.questions.length}
                    hasError={errors.has(question.id)}
                  />
                </div>
              );
            })}
          </div>
        </main>

        {/* Background decorative */}
        <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-20 overflow-hidden">
          <div
            className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]"
            style={{ background: "linear-gradient(to bottom right, var(--expert-primary-fixed), transparent)" }}
          />
          <div
            className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]"
            style={{ background: "linear-gradient(to top right, rgba(93, 91, 124, 0.3), transparent)" }}
          />
        </div>

        <SurveyBottomNav
          onPrev={catIndex > 0 ? goPrev : undefined}
          onNext={goNext}
          showPrev={catIndex > 0}
          nextLabel={isLast ? "제출하기" : "다음"}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  return null;
}
