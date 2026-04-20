"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TypeIcon } from "./TypeIcon";
import type { BuilderQuestion } from "./types";

interface Props {
  question: BuilderQuestion;
  index: number;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

export function BuilderOutlineItem({ question, index, isSelected, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const excerpt = question.questionText.trim() || "(제목 없음)";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(question.id)}
      className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer transition-colors border ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-transparent hover:bg-muted"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="드래그로 순서 변경"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="shrink-0 font-mono text-[11px] text-muted-foreground w-8">
        Q{String(index + 1).padStart(2, "0")}
      </span>

      <TypeIcon
        type={question.questionType}
        className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
      />

      <span className={`flex-1 truncate ${isSelected ? "text-foreground font-medium" : "text-foreground/80"}`}>
        {excerpt}
      </span>

      {question.isRequired && (
        <span
          className="shrink-0 h-1.5 w-1.5 rounded-full bg-destructive"
          aria-label="필수"
        />
      )}
    </div>
  );
}
