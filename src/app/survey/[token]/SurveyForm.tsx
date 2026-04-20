"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, ChevronLeft, ChevronRight, Clock, FileText, Loader2 } from "lucide-react";
import { useSurveyDraft } from "@/hooks/useSurveyDraft";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  section?: string | null;
  sort_order: number;
  is_required: boolean;
  options: string[] | null;
}

interface Section {
  name: string;
  questions: Question[];
}

function formatElapsedSeconds(seconds: number): string {
  if (seconds <= 0) return "";
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

export function SurveyForm({
  surveyId,
  surveyTitle,
  questions,
}: {
  surveyId: string;
  surveyTitle?: string;
  questions: Question[];
}) {
  const [answers, setAnswers, clearDraft] = useSurveyDraft<Record<string, string>>(
    `survey-draft-${surveyId}`,
    {},
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (startedAtRef.current === null && questions.length > 0) {
      startedAtRef.current = Date.now();
    }
  }, [questions.length]);

  // 섹션별 그룹핑
  const sections: Section[] = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const q of questions) {
      const key = q.section || "일반";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return Array.from(map, ([name, qs]) => ({ name, questions: qs }));
  }, [questions]);

  const totalSteps = sections.length;
  const current = sections[currentStep];
  const progressPercent = totalSteps > 0 ? Math.round(((currentStep + 1) / totalSteps) * 100) : 0;
  const isLastStep = currentStep === totalSteps - 1;

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function validateCurrentSection(): boolean {
    if (!current) return true;
    const missing = current.questions.filter(
      (q) => q.is_required && !answers[q.id]?.trim()
    );
    if (missing.length > 0) {
      setError("필수 항목을 모두 입력해주세요.");
      return false;
    }
    setError(null);
    return true;
  }

  function goNext() {
    if (!validateCurrentSection()) return;
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goPrev() {
    setError(null);
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!validateCurrentSection()) return;

    setSubmitting(true);
    try {
      const { error: submitError } = await supabase
        .from("edu_submissions")
        .insert({ survey_id: surveyId, answers });

      if (submitError) throw submitError;
      if (startedAtRef.current !== null) {
        setElapsedSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
      }
      clearDraft();
      setSubmitted(true);
    } catch {
      setError("제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── 제출 완료 ───
  if (submitted) {
    const answeredCount = Object.values(answers).filter((v) => v.trim()).length;
    const elapsedLabel = formatElapsedSeconds(elapsedSeconds);
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
          <CheckCircle size={36} className="text-teal-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-stone-800 mb-2">
          설문이 제출되었습니다
        </h2>
        {surveyTitle && (
          <p className="text-sm text-stone-400 mb-3">{surveyTitle}</p>
        )}
        <p className="text-sm text-stone-500">
          소중한 응답에 감사드립니다. 이 창을 닫으셔도 됩니다.
        </p>
        {(answeredCount > 0 || elapsedSeconds > 0) && (
          <div className="mt-5 inline-flex gap-5 px-4 py-2 rounded-full bg-stone-50 border border-stone-200">
            {answeredCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                <FileText size={14} />
                <b className="text-stone-700">{answeredCount}</b>개 응답
              </span>
            )}
            {elapsedLabel && (
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                <Clock size={14} />
                <b className="text-stone-700">{elapsedLabel}</b> 소요
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <p className="text-sm text-stone-500">등록된 설문 문항이 없습니다.</p>
      </div>
    );
  }

  const likertLabels: Record<string, string> = {
    "1": "매우 그렇지 않다",
    "2": "그렇지 않다",
    "3": "보통이다",
    "4": "그렇다",
    "5": "매우 그렇다",
  };

  return (
    <div>
      {/* ─── 프로그레스 바 (sticky) ─── */}
      {totalSteps > 1 && (
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-stone-200 rounded-t-xl px-5 py-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-500">
              {current.name}
            </span>
            <span className="text-xs text-stone-400">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-stone-100">
            <div
              className="h-1.5 rounded-full bg-teal-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ─── 섹션 제목 ─── */}
      {totalSteps > 1 && (
        <div className="px-1 mb-5">
          <h2 className="text-lg font-bold text-stone-800">{current.name}</h2>
        </div>
      )}

      {/* ─── 문항 렌더링 ─── */}
      <div className="space-y-6">
        {current?.questions.map((q, idx) => {
          const globalIdx =
            sections
              .slice(0, currentStep)
              .reduce((sum, s) => sum + s.questions.length, 0) + idx;

          return (
            <div
              key={q.id}
              className="rounded-xl border border-stone-200 bg-white shadow-sm p-5 sm:p-6"
            >
              <label className="block mb-4">
                <span className="text-base font-semibold text-stone-800 leading-relaxed">
                  {globalIdx + 1}. {q.question_text}
                </span>
                {q.is_required && (
                  <span className="ml-1 text-rose-500 text-xs">*</span>
                )}
              </label>

              {q.question_type === "likert" || q.question_type === "likert_5" ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400 px-0.5 mb-2">
                    <span>매우 그렇지 않다</span>
                    <span>매우 그렇다</span>
                  </div>
                  <div className="flex gap-2">
                    {["1", "2", "3", "4", "5"].map((val) => {
                      const selected = answers[q.id] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateAnswer(q.id, val)}
                          title={likertLabels[val]}
                          className={`flex-1 min-h-[48px] rounded-lg border text-sm font-medium transition-all ${
                            selected
                              ? "border-teal-500 bg-teal-50 text-teal-700 shadow-sm"
                              : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50 active:bg-stone-100"
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : q.question_type === "open_ended" || q.question_type === "text" ? (
                <textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 px-4 py-3 text-base text-stone-800 placeholder:text-stone-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="답변을 입력해주세요"
                />
              ) : q.question_type === "multiple_choice" || q.question_type === "single_choice" ? (
                <div className="space-y-2">
                  {(q.options ?? []).map((opt) => {
                    const val = typeof opt === "string" ? opt : String(opt);
                    const selected = answers[q.id] === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => updateAnswer(q.id, val)}
                        className={`w-full text-left rounded-lg border px-4 min-h-[48px] flex items-center text-sm transition-all ${
                          selected
                            ? "border-teal-500 bg-teal-50 text-teal-700 font-medium"
                            : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 active:bg-stone-100"
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-4 py-3 text-base text-stone-800 placeholder:text-stone-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="답변을 입력해주세요"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── 에러 메시지 ─── */}
      {error && (
        <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* ─── 네비게이션 버튼 ─── */}
      <div className="mt-6 flex gap-3">
        {currentStep > 0 && (
          <button
            type="button"
            onClick={goPrev}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors"
          >
            <ChevronLeft size={16} />
            이전
          </button>
        )}

        {isLastStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                제출 중...
              </>
            ) : (
              "설문 제출하기"
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="flex-1 rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5"
          >
            다음
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
