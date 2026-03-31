"use client";

import { CalendarDays } from "lucide-react";

export function Header() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <span>
          {year}년 {month}월 CS 조사
        </span>
      </div>
    </header>
  );
}
