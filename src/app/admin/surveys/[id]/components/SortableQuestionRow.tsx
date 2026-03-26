"use client";

import { GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Question, questionTypeLabels, parseOptions } from "./types";

interface Props {
  question: Question;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function SortableQuestionRow({ question, index, isSelected, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined };
  const opts = parseOptions(question.options);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(question.id)}
      className={`group flex items-start gap-2.5 px-4 py-3 border-b border-stone-100 last:border-0 cursor-pointer transition-colors ${
        isSelected ? "bg-teal-50/50 border-l-2 border-l-teal-500" : "hover:bg-stone-50/50"
      }`}
    >
      <button {...attributes} {...listeners} className="shrink-0 mt-1 cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none" onClick={(e) => e.stopPropagation()}>
        <GripVertical size={16} />
      </button>

      <span className="text-xs font-mono text-stone-400 mt-0.5 shrink-0 w-10">
        {question.question_code || `Q${index + 1}`}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-800 leading-relaxed">
          {question.question_text}
          {question.is_required && <span className="text-red-400 ml-0.5">*</span>}
        </p>
        {opts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {opts.map((opt, i) => <span key={i} className="inline-flex rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">{opt}</span>)}
          </div>
        )}
      </div>

      <span className="inline-flex rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500 shrink-0">
        {questionTypeLabels[question.question_type] ?? question.question_type}
      </span>
    </div>
  );
}
