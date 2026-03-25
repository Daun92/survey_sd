"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, Loader2 } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  sort_order: number;
  is_required: boolean;
  options: string[] | null;
}

export function SurveyForm({
  surveyId,
  questions,
}: {
  surveyId: string;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const missing = questions.filter(
      (q) => q.is_required && !answers[q.id]?.trim()
    );
    if (missing.length > 0) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: submitError } = await supabase
        .from("edu_submissions")
        .insert({
          survey_id: surveyId,
          answers,
        });

      if (submitError) throw submitError;
      setSubmitted(true);
    } catch {
      setError("제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <CheckCircle
          size={48}
          className="mx-auto text-teal-500 mb-4"
          aria-hidden="true"
        />
        <h2 className="text-xl font-bold text-stone-800 mb-2">
          설문이 제출되었습니다
        </h2>
        <p className="text-sm text-stone-500">
          소중한 응답에 감사드립니다.
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <p className="text-sm text-stone-500">
          등록된 설문 문항이 없습니다.
        </p>
      </div>
    );
  }

  const likertOptions = ["1", "2", "3", "4", "5"];

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="rounded-xl border border-stone-200 bg-white shadow-sm p-6"
          >
            <label className="block mb-4">
              <span className="text-sm font-semibold text-stone-800">
                {idx + 1}. {q.question_text}
              </span>
              {q.is_required && (
                <span className="ml-1 text-red-500 text-xs">*</span>
              )}
            </label>

            {q.question_type === "likert" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-400 px-1 mb-1">
                  <span>매우 그렇지 않다</span>
                  <span>매우 그렇다</span>
                </div>
                <div className="flex gap-2">
                  {(q.options ?? likertOptions).map((opt) => {
                    const val = typeof opt === "string" ? opt : String(opt);
                    const selected = answers[q.id] === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => updateAnswer(q.id, val)}
                        className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                          selected
                            ? "border-teal-500 bg-teal-50 text-teal-700"
                            : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : q.question_type === "open_ended" ? (
              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="답변을 입력해주세요"
              />
            ) : q.question_type === "multiple_choice" ? (
              <div className="space-y-2">
                {(q.options ?? []).map((opt) => {
                  const val = typeof opt === "string" ? opt : String(opt);
                  const selected = answers[q.id] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => updateAnswer(q.id, val)}
                      className={`w-full text-left rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                        selected
                          ? "border-teal-500 bg-teal-50 text-teal-700 font-medium"
                          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
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
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="답변을 입력해주세요"
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
      </div>
    </form>
  );
}
