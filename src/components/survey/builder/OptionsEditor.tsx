"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

interface OptionsEditorProps {
  value: string | null;
  onChange: (next: string | null) => void;
}

function parseOptions(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    return [];
  } catch {
    return [];
  }
}

function serialize(options: string[]): string | null {
  if (options.length === 0) return null;
  return JSON.stringify(options);
}

export function OptionsEditor({ value, onChange }: OptionsEditorProps) {
  const options = parseOptions(value);

  function update(idx: number, text: string) {
    const next = options.slice();
    next[idx] = text;
    onChange(serialize(next));
  }

  function add() {
    onChange(serialize([...options, ""]));
  }

  function remove(idx: number) {
    const next = options.filter((_, i) => i !== idx);
    onChange(serialize(next));
  }

  return (
    <div className="space-y-2">
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">
          선택지가 없습니다. 아래 버튼으로 추가하세요.
        </p>
      )}
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="w-6 text-xs text-muted-foreground text-right">
            {idx + 1}.
          </span>
          <Input
            value={opt}
            onChange={(e) => update(idx, e.target.value)}
            placeholder={`선택지 ${idx + 1}`}
            className="flex-1 h-8 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => remove(idx)}
            aria-label="선택지 삭제"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full h-8"
      >
        <Plus className="mr-1 h-4 w-4" /> 선택지 추가
      </Button>
    </div>
  );
}
