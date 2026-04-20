"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { BuilderMetaBar } from "./BuilderMetaBar";
import { QuestionPreview } from "./QuestionPreview";
import type { BuilderQuestion, BuilderSurvey } from "./types";

interface BuilderCanvasProps {
  survey: BuilderSurvey;
  questions: BuilderQuestion[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  previewMode: boolean;
  onUpdateSurvey: (field: string, value: string | boolean) => void | Promise<void>;
}

export function BuilderCanvas({
  survey,
  questions,
  selectedId,
  onSelect,
  previewMode,
  onUpdateSurvey,
}: BuilderCanvasProps) {
  const [previewValues, setPreviewValues] = useState<Map<number, unknown>>(new Map());

  const selectedIndex = questions.findIndex((q) => q.id === selectedId);
  const selected = selectedIndex >= 0 ? questions[selectedIndex] : null;

  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex >= 0 && selectedIndex < questions.length - 1;

  function setValue(qId: number, v: unknown) {
    setPreviewValues((prev) => {
      const next = new Map(prev);
      next.set(qId, v);
      return next;
    });
  }

  return (
    <main className="flex h-full w-full flex-col bg-background">
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <BuilderMetaBar survey={survey} onUpdate={onUpdateSurvey} />

        {selected ? (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {selectedIndex + 1} / {questions.length}
              </span>
              <span className="inline-flex items-center gap-1">
                {previewMode ? (
                  <>
                    <Eye className="h-3 w-3" /> 미리보기 모드 (입력 가능)
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3 w-3" /> 편집 모드
                  </>
                )}
              </span>
            </div>

            <QuestionPreview
              question={selected}
              index={selectedIndex}
              value={previewValues.get(selected.id)}
              onChange={(v) => setValue(selected.id, v)}
              disabled={!previewMode}
            />

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={!canPrev}
                onClick={() =>
                  canPrev && onSelect(questions[selectedIndex - 1].id)
                }
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> 이전 문항
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!canNext}
                onClick={() =>
                  canNext && onSelect(questions[selectedIndex + 1].id)
                }
              >
                다음 문항 <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {questions.length === 0
              ? "문항이 없습니다. 상단의 [문항 추가] 또는 [마법사]로 시작하세요."
              : "왼쪽 아웃라인에서 문항을 선택하세요."}
          </div>
        )}
      </div>
    </main>
  );
}
