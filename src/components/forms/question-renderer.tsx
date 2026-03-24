"use client";

import { Textarea } from "@/components/ui/textarea";

interface Question {
  id: number;
  order: number;
  text: string;
  type: string;
  category: string | null;
  required: boolean;
  options: string[] | null;
}

interface QuestionRendererProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  index: number;
}

const ratingLabels5 = ["매우 불만족", "불만족", "보통", "만족", "매우 만족"];

export function QuestionRenderer({ question, value, onChange, index }: QuestionRendererProps) {
  return (
    <div className="space-y-3">
      {/* 문항 헤더 */}
      <div className="flex gap-2">
        <span className="shrink-0 text-sm font-semibold text-muted-foreground">
          {index + 1}.
        </span>
        <div>
          <p className="text-sm font-medium leading-relaxed">
            {question.text}
            {question.required && <span className="ml-1 text-red-500">*</span>}
          </p>
          {question.category && (
            <span className="text-xs text-muted-foreground">[{question.category}]</span>
          )}
        </div>
      </div>

      {/* 응답 입력 */}
      <div className="ml-6">
        {question.type === "rating_5" && (
          <Rating5Input value={value} onChange={onChange} />
        )}
        {question.type === "rating_10" && (
          <Rating10Input value={value} onChange={onChange} />
        )}
        {question.type === "text" && (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="의견을 자유롭게 작성해 주세요"
            rows={3}
            className="max-w-lg"
          />
        )}
        {question.type === "single_choice" && question.options && (
          <SingleChoiceInput value={value} onChange={onChange} options={question.options} questionId={question.id} />
        )}
        {question.type === "multi_choice" && question.options && (
          <MultiChoiceInput value={value} onChange={onChange} options={question.options} />
        )}
      </div>
    </div>
  );
}

function Rating5Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(String(n))}
          className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors sm:px-4 sm:py-3 ${
            value === String(n)
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-border hover:bg-muted"
          }`}
        >
          <span className="text-lg font-bold">{n}</span>
          <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
            {ratingLabels5[n - 1]}
          </span>
        </button>
      ))}
    </div>
  );
}

function Rating10Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(String(n))}
          className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
            value === String(n)
              ? "border-primary bg-primary/10 text-primary font-bold"
              : "border-border hover:bg-muted"
          }`}
        >
          {n}
        </button>
      ))}
      <div className="flex w-full justify-between text-[10px] text-muted-foreground mt-1 px-1">
        <span>매우 불만족</span>
        <span>매우 만족</span>
      </div>
    </div>
  );
}

function SingleChoiceInput({
  value, onChange, options, questionId,
}: { value: string; onChange: (v: string) => void; options: string[]; questionId: number }) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
            value === opt
              ? "border-primary bg-primary/10"
              : "border-border hover:bg-muted"
          }`}
        >
          <input
            type="radio"
            name={`q-${questionId}`}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="accent-primary"
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function MultiChoiceInput({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: string[] }) {
  const selected = value ? value.split(",") : [];

  function toggle(opt: string) {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next.join(","));
  }

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
            selected.includes(opt)
              ? "border-primary bg-primary/10"
              : "border-border hover:bg-muted"
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="accent-primary"
          />
          {opt}
        </label>
      ))}
    </div>
  );
}
