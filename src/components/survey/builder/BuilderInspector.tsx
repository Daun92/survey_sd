"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Copy, Trash2, GitBranch } from "lucide-react";
import { OptionsEditor } from "./OptionsEditor";
import {
  CATEGORIES,
  QUESTION_TYPES,
  isChoiceType,
  type BuilderQuestion,
} from "./types";

interface BuilderInspectorProps {
  question: BuilderQuestion | null;
  onChange: <K extends keyof BuilderQuestion>(field: K, value: BuilderQuestion[K]) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function BuilderInspector({
  question,
  onChange,
  onDelete,
  onDuplicate,
}: BuilderInspectorProps) {
  if (!question) {
    return (
      <aside className="flex h-full w-full flex-col border-l border-border bg-card">
        <header className="border-b border-border px-4 py-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            인스펙터
          </h3>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          왼쪽에서 문항을 선택하세요
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-card">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          문항 편집
        </h3>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="inspector-type" className="text-xs">타입</Label>
          <Select
            value={question.questionType}
            onValueChange={(v) => {
              if (v) onChange("questionType", v);
            }}
          >
            <SelectTrigger id="inspector-type" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inspector-category" className="text-xs">카테고리</Label>
          <Select
            value={question.category ?? "__none__"}
            onValueChange={(v) => {
              if (v === null) return;
              onChange("category", v === "__none__" ? null : v);
            }}
          >
            <SelectTrigger id="inspector-category" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">(없음)</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inspector-title" className="text-xs">문항 제목</Label>
          <Textarea
            id="inspector-title"
            value={question.questionText}
            onChange={(e) => onChange("questionText", e.target.value)}
            rows={3}
            placeholder="응답자에게 보여줄 문항 텍스트"
            className="resize-none text-sm"
          />
        </div>

        {isChoiceType(question.questionType) && (
          <div className="space-y-2">
            <Label className="text-xs">선택지</Label>
            <OptionsEditor
              value={question.optionsJson}
              onChange={(next) => onChange("optionsJson", next)}
            />
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs">필수 응답</Label>
            <p className="text-[11px] text-muted-foreground">
              미응답 시 제출 불가
            </p>
          </div>
          <Switch
            checked={question.isRequired}
            onCheckedChange={(v) => onChange("isRequired", v)}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs">조건 로직</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="w-full justify-start text-xs text-muted-foreground"
          >
            <GitBranch className="mr-2 h-3.5 w-3.5" />
            분기 규칙 추가 (추가 예정)
          </Button>
        </div>
      </div>

      <footer className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onDuplicate}
          className="flex-1"
        >
          <Copy className="mr-1 h-4 w-4" /> 복제
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-1 h-4 w-4" /> 삭제
        </Button>
      </footer>
    </aside>
  );
}
