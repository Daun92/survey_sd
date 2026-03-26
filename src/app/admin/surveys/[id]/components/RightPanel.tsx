"use client";

import { Eye, Pencil } from "lucide-react";
import SurveyPreview from "../survey-preview";
import { QuestionForm } from "./QuestionForm";
import { type Question, type SurveySettings, type PanelMode, type PreviewTab } from "./types";

interface Props {
  panelMode: PanelMode;
  previewTab: PreviewTab;
  onPreviewTabChange: (tab: PreviewTab) => void;
  surveyId: string;
  surveyTitle: string;
  questions: Question[];
  liveSettings: SurveySettings;
  editingQuestion: Question | null;
  nextSortOrder: number;
  onSaved: () => void;
  onCancel: () => void;
  onDeleted: () => void;
}

export function RightPanel({
  panelMode, previewTab, onPreviewTabChange,
  surveyId, surveyTitle, questions, liveSettings,
  editingQuestion, nextSortOrder,
  onSaved, onCancel, onDeleted,
}: Props) {
  const isPreview = panelMode === "preview";

  return (
    <div className="sticky top-8">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={onCancel}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isPreview ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"
          }`}
        >
          <Eye size={13} /> 미리보기
        </button>
        {!isPreview && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white">
            <Pencil size={13} /> {panelMode === "add" ? "문항 추가" : "문항 편집"}
          </span>
        )}
      </div>

      {isPreview ? (
        <SurveyPreview
          surveyTitle={surveyTitle}
          questions={questions}
          settings={liveSettings}
          activeTab={previewTab}
          onTabChange={onPreviewTabChange}
        />
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <QuestionForm
            surveyId={surveyId}
            question={panelMode === "edit" ? (editingQuestion ?? undefined) : undefined}
            nextSortOrder={nextSortOrder}
            onDone={onSaved}
            onCancel={onCancel}
            onDeleted={panelMode === "edit" ? onDeleted : undefined}
          />
        </div>
      )}
    </div>
  );
}
