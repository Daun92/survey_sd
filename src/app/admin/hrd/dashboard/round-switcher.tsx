"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

export interface RoundOption {
  id: string;
  round_number: number;
  year: number;
  status: string;
}

interface Props {
  rounds: RoundOption[];
  selectedRoundNumber: number;
}

export function RoundSwitcher({ rounds, selectedRoundNumber }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  if (rounds.length <= 1) {
    const only = rounds[0];
    if (!only) return null;
    return (
      <span className="inline-flex items-center rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
        {only.year}년 / {only.round_number}회
      </span>
    );
  }

  return (
    <div className="relative">
      <select
        aria-label="회차 선택"
        value={selectedRoundNumber}
        onChange={(e) => {
          const sp = new URLSearchParams(search.toString());
          sp.set("round", e.target.value);
          router.push(`${pathname}?${sp.toString()}`);
        }}
        className="appearance-none rounded-md border border-stone-200 bg-white pl-3 pr-8 py-1.5 text-sm font-medium text-stone-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      >
        {rounds.map((r) => (
          <option key={r.id} value={r.round_number}>
            {r.year}년 · {r.round_number}회{" "}
            {r.status === "collecting" ? "(수집중)" : r.status === "closed" ? "(마감)" : ""}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-stone-400"
      />
    </div>
  );
}
