"use client";

import { Eye, Pencil, Layers } from "lucide-react";
import TemplatePreview from "./TemplatePreview";
import { QuestionForm } from "./QuestionForm";
import { SectionForm } from "./SectionForm";
import { type CSQuestion, type SurveySettings, type SectionIntro, type PanelMode, type PreviewTab } from "./types";

interface Props {
  panelMode: PanelMode;
  previewTab: PreviewTab;
  onPreviewTabChange: (tab: PreviewTab) => void;
  templateId: string;
  templateName: string;
  questions: CSQuestion[];
  liveSettings: SurveySettings;
  editingQuestion: CSQuestion | null;
  editingSectionName: string | null;
  editingSectionQuestionCount: number;
  sectionNames: string[];
  defaultSection: string | null;
  nextSortOrder: number;
  onSaved: () => void;
  onCancel: () => void;
  onDeleted: () => void;
}

export function RightPanel({
  panelMode, previewTab, onPreviewTabChange,
  templateId, templateName, questions, liveSettings,
  editingQuestion, editingSectionName, editingSectionQuestionCount,
  sectionNames, defaultSection,
  nextSortOrder,
  onSaved, onCancel, onDeleted,
}: Props) {
  const isPreview = panelMode === "preview";
  const isSectionEdit = panelMode === "section_edit";

  return (
    <div className="sticky top-4 h-[calc(100vh-3rem)] overflow-y-auto">
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={onCancel}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isPreview ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"
          }`}
        >
          <Eye size={13} /> 미리보기
        </button>
        {!isPreview && !isSectionEdit && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white">
            <Pencil size={13} /> {panelMode === "add" ? "문항 추가" : "문항 편집"}
          </span>
        )}
        {isSectionEdit && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white">
            <Layers size={13} /> 섹션 편집
          </span>
        )}
      </div>

      {isPreview ? (
        <TemplatePreview
          templateName={templateName}
          questions={questions}
          settings={liveSettings}
          activeTab={previewTab}
          onTabChange={onPreviewTabChange}
        />
      ) : isSectionEdit && editingSectionName ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <SectionForm
            key={editingSectionName}
            templateId={templateId}
            sectionName={editingSectionName}
            questionCount={editingSectionQuestionCount}
            intro={liveSettings.section_intros?.[editingSectionName]}
            onDone={onSaved}
            onCancel={onCancel}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <QuestionForm
            key={panelMode === "edit" ? editingQuestion?.id : `__add__${defaultSection}`}
            templateId={templateId}
            question={panelMode === "edit" ? (editingQuestion ?? undefined) : undefined}
            allQuestions={questions}
            sectionNames={sectionNames}
            defaultSection={defaultSection ?? undefined}
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
