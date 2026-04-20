"use client";

import { LikertScale, LIKERT_5_AGREE_LABELS } from "@/components/survey/LikertScale";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { BuilderQuestion } from "./types";

interface QuestionPreviewProps {
  question: BuilderQuestion;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled: boolean;
  index: number;
}

function parseOptions(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export function QuestionPreview({
  question,
  value,
  onChange,
  disabled,
  index,
}: QuestionPreviewProps) {
  const qNumber = `Q${String(index + 1).padStart(2, "0")}`;
  const title = question.questionText || (
    <span className="text-muted-foreground italic">제목을 입력하세요</span>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {qNumber}
        </span>
        <div className="flex-1">
          <h2 className="text-base font-semibold leading-relaxed">
            {title}
            {question.isRequired && (
              <span className="ml-1 text-destructive">*</span>
            )}
          </h2>
          {question.category && (
            <Badge variant="outline" className="mt-2 text-[10px]">
              {question.category}
            </Badge>
          )}
        </div>
      </header>

      <div className="pl-10">
        <PreviewBody
          question={question}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function PreviewBody({
  question,
  value,
  onChange,
  disabled,
}: {
  question: BuilderQuestion;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled: boolean;
}) {
  const type = question.questionType;

  if (type === "rating_5" || type === "likert_5") {
    return (
      <LikertScale
        scale={5}
        labels={type === "likert_5" ? LIKERT_5_AGREE_LABELS : undefined}
        value={typeof value === "number" ? value : undefined}
        onChange={(v) => onChange(v)}
        disabled={disabled}
      />
    );
  }

  if (type === "likert_7") {
    return (
      <LikertScale
        scale={7}
        value={typeof value === "number" ? value : undefined}
        onChange={(v) => onChange(v)}
        disabled={disabled}
      />
    );
  }

  if (type === "rating_10") {
    const current = typeof value === "number" ? value : undefined;
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-md border text-sm font-medium transition disabled:opacity-60 ${
              current === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary/40"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (type === "single_choice") {
    const options = parseOptions(question.optionsJson);
    const current = typeof value === "string" ? value : "";
    if (options.length === 0) {
      return <EmptyOptions />;
    }
    return (
      <ul className="space-y-2">
        {options.map((opt, i) => (
          <li key={i}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                current === opt
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              } ${disabled ? "cursor-default" : ""}`}
            >
              <input
                type="radio"
                name={`preview-${question.id}`}
                checked={current === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
                className="accent-primary"
              />
              <span>{opt}</span>
            </label>
          </li>
        ))}
      </ul>
    );
  }

  if (type === "multi_choice" || type === "multiple_choice") {
    const options = parseOptions(question.optionsJson);
    const current = Array.isArray(value) ? (value as string[]) : [];
    if (options.length === 0) {
      return <EmptyOptions />;
    }
    return (
      <ul className="space-y-2">
        {options.map((opt, i) => {
          const checked = current.includes(opt);
          return (
            <li key={i}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                } ${disabled ? "cursor-default" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    const next = checked
                      ? current.filter((x) => x !== opt)
                      : [...current, opt];
                    onChange(next);
                  }}
                  className="accent-primary"
                />
                <span>{opt}</span>
              </label>
            </li>
          );
        })}
      </ul>
    );
  }

  if (type === "yes_no") {
    const current = typeof value === "string" ? value : "";
    return (
      <div className="flex gap-2">
        {[
          { v: "yes", label: "예" },
          { v: "no", label: "아니오" },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.v)}
            className={`h-10 flex-1 rounded-md border text-sm font-medium transition disabled:opacity-60 ${
              current === opt.v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  // text (default)
  return (
    <Textarea
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={3}
      placeholder="응답 내용을 입력하세요"
      className="resize-none"
    />
  );
}

function EmptyOptions() {
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
      선택지가 없습니다. 우측 인스펙터에서 선택지를 추가하세요.
    </div>
  );
}
