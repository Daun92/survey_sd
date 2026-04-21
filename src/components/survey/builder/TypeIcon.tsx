"use client";

import {
  Star,
  Gauge,
  CircleDot,
  ListChecks,
  CheckSquare,
  Pen,
  ToggleLeft,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  rating_5: Star,
  rating_10: Gauge,
  likert_5: CircleDot,
  likert_6: CircleDot,
  likert_7: CircleDot,
  single_choice: ListChecks,
  multi_choice: CheckSquare,
  multiple_choice: CheckSquare,
  text: Pen,
  yes_no: ToggleLeft,
};

export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = MAP[type] ?? HelpCircle;
  return <Icon className={className ?? "h-4 w-4"} aria-hidden />;
}
