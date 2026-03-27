"use client";

import { GripVertical, GitBranch, Info } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Question, questionTypeLabels, parseOptions } from "./types";

interface Props {
  question: Question;
  index: number;
  displayOrder: number | null; // null = info_block (번호 제외)
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function SortableQuestionRow({ question, index, displayOrder, isSelected, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined };
  const opts = parseOptions(question.options);
  const isInfoBlock = question.question_type === "info_block";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(question.id)}
      className={`group flex items-start gap-2 px-4 py-3 border-b border-stone-100 last:border-0 cursor-pointer transition-colors ${
        isSelected ? "bg-teal-50/50 border-l-2 border-l-teal-500" : "hover:bg-stone-50/50"
      }`}
    >
      <button {...attributes} {...listeners} className="shrink-0 mt-1 cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none" onClick={(e) => e.stopPropagation()}>
        <GripVertical size={16} />
      </button>

      {/* 순번 (#N) — 자동 계산, info_block은 아이콘 표시 */}
      <span className="text-[11px] text-stone-300 mt-0.5 shrink-0 w-5 text-right tabular-nums">
        {isInfoBlock ? (
          <Info size={12} className="inline text-blue-300" />
        ) : (
          displayOrder != null ? `#${displayOrder}` : ""
        )}
      </span>

      {/* 문항 코드 — 사용자 설정 */}
      {question.question_code && (
        <span className="text-[11px] font-mono font-semibold text-teal-600 mt-0.5 shrink-0 bg-teal-50 rounded px-1 py-0.5">
          {question.question_code}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-relaxed ${isInfoBlock ? "text-stone-500 italic" : "text-stone-800"}`}>
          {question.skip_logic && (
            <span className="inline-flex items-center gap-0.5 text-amber-500 mr-1" title="조건부 문항">
              <GitBranch size={12} />
            </span>
          )}
          {question.question_text}
          {question.is_required && <span className="text-red-400 ml-0.5">*</span>}
        </p>
        {opts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {opts.map((opt, i) => <span key={i} className="inline-flex rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">{opt}</span>)}
          </div>
        )}
      </div>

      <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium shrink-0 ${
        isInfoBlock ? "bg-blue-50 text-blue-500" : "bg-stone-100 text-stone-500"
      }`}>
        {questionTypeLabels[question.question_type] ?? question.question_type}
      </span>
    </div>
  );
}
