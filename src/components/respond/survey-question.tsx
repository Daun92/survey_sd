"use client";

import { Check, CheckSquare } from "lucide-react";
import { ExpertInsightBox } from "./expert-insight-box";

interface Question {
  id: number;
  order: number;
  text: string;
  type: string;
  category: string | null;
  required: boolean;
  options: string[] | null;
}

interface SurveyQuestionProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  index: number;
  total: number;
  hasError?: boolean;
}

export function SurveyQuestion({
  question,
  value,
  onChange,
  index,
  total,
  hasError,
}: SurveyQuestionProps) {
  return (
    <div className="space-y-10">
      {/* Question Header */}
      <div className="space-y-4">
        <span
          className="font-headline text-2xl font-bold block"
          style={{ color: "var(--expert-primary-accent)" }}
        >
          Q{index + 1}.
        </span>
        <h3
          className="font-headline text-2xl sm:text-3xl font-semibold leading-tight"
          style={{ color: "var(--expert-on-surface)" }}
        >
          {question.text}
          {question.required && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </h3>
        {hasError && (
          <p className="text-sm text-red-500 font-medium">
            이 문항은 필수입니다
          </p>
        )}
      </div>

      {/* Answer Input */}
      <div>
        {question.type === "single_choice" && question.options && (
          <SingleChoiceExpert
            value={value}
            onChange={onChange}
            options={question.options}
          />
        )}
        {question.type === "multi_choice" && question.options && (
          <MultiChoiceExpert
            value={value}
            onChange={onChange}
            options={question.options}
          />
        )}
        {question.type === "rating_10" && (
          <NpsExpert value={value} onChange={onChange} />
        )}
        {question.type === "rating_5" && (
          <Rating5Expert value={value} onChange={onChange} />
        )}
        {question.type === "text" && (
          <TextExpert value={value} onChange={onChange} />
        )}
      </div>

      {/* Expert Insight */}
      {question.category && (
        <ExpertInsightBox>
          <p>
            이 질문은 <strong>{question.category}</strong> 영역을 평가합니다.
            솔직한 답변이 정확한 분석에 도움이 됩니다.
          </p>
        </ExpertInsightBox>
      )}
    </div>
  );
}

/* ─── Single Choice ─── */
function SingleChoiceExpert({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="w-full text-left p-6 rounded-xl transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: selected
                ? "rgba(0, 154, 90, 0.08)"
                : "var(--expert-surface-lowest)",
              border: selected
                ? "2px solid var(--expert-primary)"
                : "1.5px solid var(--expert-outline-variant)",
              boxShadow: selected ? "var(--expert-shadow)" : "none",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-lg font-medium"
                style={{ color: "var(--expert-on-surface)" }}
              >
                {opt}
              </span>
              {selected ? (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "var(--expert-primary)" }}
                >
                  <Check className="h-4 w-4 text-white" />
                </div>
              ) : (
                <div
                  className="w-6 h-6 rounded-full border-2"
                  style={{ borderColor: "var(--expert-outline-variant)" }}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Multi Choice ─── */
function MultiChoiceExpert({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const selected = value ? value.split(",") : [];

  function toggle(opt: string) {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next.join(","));
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className="w-full text-left p-6 rounded-xl transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: isSelected
                ? "rgba(0, 154, 90, 0.08)"
                : "var(--expert-surface-lowest)",
              border: isSelected
                ? "2px solid var(--expert-primary)"
                : "1.5px solid var(--expert-outline-variant)",
              boxShadow: isSelected ? "var(--expert-shadow)" : "none",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-lg font-medium"
                style={{ color: "var(--expert-on-surface)" }}
              >
                {opt}
              </span>
              {isSelected ? (
                <div
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: "var(--expert-primary)" }}
                >
                  <CheckSquare className="h-4 w-4 text-white" />
                </div>
              ) : (
                <div
                  className="w-6 h-6 rounded border-2"
                  style={{ borderColor: "var(--expert-outline-variant)" }}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── NPS (0-10) ─── */
function NpsExpert({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  function getZoneStyle(n: number, isSelected: boolean) {
    if (n <= 6) {
      return {
        borderColor: isSelected ? "var(--expert-nps-red)" : "var(--expert-nps-red)",
        backgroundColor: isSelected
          ? "var(--expert-nps-red)"
          : "var(--expert-nps-red-bg)",
        color: isSelected ? "#ffffff" : "var(--expert-nps-red)",
      };
    }
    if (n <= 8) {
      return {
        borderColor: isSelected ? "#d97706" : "#fbbf24",
        backgroundColor: isSelected ? "#d97706" : "var(--expert-nps-yellow-bg)",
        color: isSelected ? "#ffffff" : "#b45309",
      };
    }
    return {
      borderColor: isSelected ? "var(--expert-primary)" : "#6ee7b7",
      backgroundColor: isSelected
        ? "var(--expert-primary)"
        : "var(--expert-nps-green-bg)",
      color: isSelected ? "#ffffff" : "var(--expert-primary)",
    };
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-11 gap-2 md:gap-3">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const isSelected = value === String(n);
          const style = getZoneStyle(n, isSelected);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className="aspect-square flex items-center justify-center rounded-xl text-lg font-bold border transition-all duration-200 hover:opacity-80 active:scale-95"
              style={style}
            >
              {n}
            </button>
          );
        })}
      </div>
      {/* Labels */}
      <div
        className="flex justify-between items-center text-sm font-medium px-1"
        style={{ color: "var(--expert-on-surface-variant)" }}
      >
        <span className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--expert-nps-red)" }}
          />
          추천 의향 없음
        </span>
        <span className="flex items-center gap-2">
          매우 추천함
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--expert-primary)" }}
          />
        </span>
      </div>
    </div>
  );
}

/* ─── Rating 5 ─── */
const ratingLabels5 = ["매우 불만족", "불만족", "보통", "만족", "매우 만족"];

function Rating5Expert({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {[1, 2, 3, 4, 5].map((n) => {
        const isSelected = value === String(n);
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            className="flex flex-col items-center gap-2 p-4 sm:p-6 rounded-xl transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: isSelected
                ? "rgba(0, 154, 90, 0.08)"
                : "var(--expert-surface-lowest)",
              border: isSelected
                ? "2px solid var(--expert-primary)"
                : "1.5px solid var(--expert-outline-variant)",
              boxShadow: isSelected ? "var(--expert-shadow)" : "none",
            }}
          >
            <span
              className="text-2xl font-bold"
              style={{
                color: isSelected
                  ? "var(--expert-primary)"
                  : "var(--expert-on-surface)",
              }}
            >
              {n}
            </span>
            <span
              className="text-[10px] sm:text-xs leading-tight text-center font-medium"
              style={{ color: "var(--expert-on-surface-variant)" }}
            >
              {ratingLabels5[n - 1]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Text ─── */
function TextExpert({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="의견을 자유롭게 작성해 주세요"
      rows={4}
      className="w-full max-w-2xl p-6 rounded-xl text-base resize-y transition-all duration-200 outline-none"
      style={{
        backgroundColor: "var(--expert-surface-lowest)",
        border: "1.5px solid var(--expert-outline-variant)",
        color: "var(--expert-on-surface)",
        boxShadow: "none",
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "var(--expert-primary)";
        e.target.style.boxShadow =
          "0 0 0 3px rgba(0, 106, 60, 0.15)";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "var(--expert-outline-variant)";
        e.target.style.boxShadow = "none";
      }}
    />
  );
}
