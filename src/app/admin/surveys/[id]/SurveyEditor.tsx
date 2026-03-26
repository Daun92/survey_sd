"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Users, Layers, Link2, ExternalLink, QrCode } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import AiFab from "./ai-fab";
import { reorderQuestions } from "./actions";
import { CopyUrlButton } from "./CopyUrlButton";

import { type EditorProps, type SurveySettings, type PanelMode, type PreviewTab, type Question } from "./components/types";
import { SurveyInfoEditor } from "./components/SurveyInfoEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { SortableQuestionRow } from "./components/SortableQuestionRow";
import { DeleteSurveyButton } from "./components/DeleteSurveyButton";
import { RightPanel } from "./components/RightPanel";

export default function SurveyEditor({ survey, questions, submissionCount }: EditorProps) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  // ─── State ───
  const [panelMode, setPanelMode] = useState<PanelMode>("preview");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("landing");
  const [liveSettings, setLiveSettings] = useState<SurveySettings>(() => (survey.settings as SurveySettings) ?? {});

  // ─── Drag & Drop ───
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(questions, oldIndex, newIndex);
    try {
      await reorderQuestions(survey.id, reordered.map((q, idx) => ({ id: q.id, sort_order: idx })));
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "순서 변경 실패");
    }
  };

  // ─── Computed ───
  const nextSortOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.sort_order)) + 1 : 0;
  const editingQuestion = editingQuestionId ? questions.find((q) => q.id === editingQuestionId) ?? null : null;

  const sections: Record<string, (Question & { _globalIndex: number })[]> = {};
  questions.forEach((q, idx) => {
    const section = q.section || "기타";
    if (!sections[section]) sections[section] = [];
    sections[section].push({ ...q, _globalIndex: idx });
  });

  const handleSelectQuestion = (id: string) => {
    setEditingQuestionId(id);
    setPanelMode("edit");
  };

  const handlePanelSaved = () => {
    setPanelMode("preview");
    setPreviewTab("questions");
    setEditingQuestionId(null);
    refresh();
  };

  const handlePanelCancel = () => {
    setPanelMode("preview");
    setEditingQuestionId(null);
  };

  return (
    <div className="flex gap-6 items-start">
      {/* ── Left Column ── */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Title + Status */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <SurveyInfoEditor survey={survey} onUpdated={refresh} />
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-stone-100">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-stone-400" />
              <span className="text-sm text-stone-600"><strong className="text-stone-800">{questions.length}</strong> 문항</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} className="text-stone-400" />
              <span className="text-sm text-stone-600"><strong className="text-teal-600">{submissionCount}</strong> 응답</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-stone-400" />
              <span className="text-sm text-stone-600"><strong className="text-stone-800">{Object.keys(sections).length}</strong> 섹션</span>
            </div>
            <div className="ml-auto">
              <DeleteSurveyButton surveyId={survey.id} />
            </div>
          </div>
        </div>

        {/* Settings */}
        <SettingsPanel
          surveyId={survey.id}
          initialSettings={liveSettings}
          onSettingsChange={setLiveSettings}
          onSaved={refresh}
        />

        {/* Question List */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">설문 문항</h2>
            <button
              onClick={() => { setPanelMode("add"); setEditingQuestionId(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              <Plus size={13} /> 문항 추가
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="p-10 text-center">
              <div className="flex justify-center mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-400"><Plus size={20} /></div>
              </div>
              <p className="text-sm text-stone-500 mb-3">문항을 추가해 주세요</p>
              <button onClick={() => setPanelMode("add")} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"><Plus size={14} /> 첫 문항 추가</button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div>
                  {Object.entries(sections).map(([sectionName, sectionQuestions]) => (
                    <div key={sectionName}>
                      <div className="px-4 py-2 bg-stone-50/80 border-b border-stone-100">
                        <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">{sectionName}</span>
                        <span className="text-[11px] text-stone-400 ml-1.5">({sectionQuestions.length})</span>
                      </div>
                      {sectionQuestions.map((question) => (
                        <SortableQuestionRow
                          key={question.id}
                          question={question}
                          index={question._globalIndex}
                          isSelected={editingQuestionId === question.id && panelMode === "edit"}
                          onSelect={handleSelectQuestion}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Distribution Link */}
        {survey.url_token && (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
            <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-2">
              <QrCode size={16} className="text-teal-600" />
              배포 링크
            </h3>
            <div className="flex items-center gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
              <Link2 size={14} className="text-stone-400 shrink-0" />
              <span className="text-sm text-stone-600 truncate font-mono flex-1">/survey/{survey.url_token}</span>
              <CopyUrlButton urlToken={survey.url_token} />
              <a href={`/survey/${survey.url_token}`} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors" title="새 탭에서 열기">
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel ── */}
      <div className="hidden lg:block w-[400px] shrink-0">
        <RightPanel
          panelMode={panelMode}
          previewTab={previewTab}
          onPreviewTabChange={setPreviewTab}
          surveyId={survey.id}
          surveyTitle={survey.title}
          questions={questions}
          liveSettings={liveSettings}
          editingQuestion={editingQuestion}
          nextSortOrder={nextSortOrder}
          onSaved={handlePanelSaved}
          onCancel={handlePanelCancel}
          onDeleted={handlePanelSaved}
        />
      </div>

      {/* AI FAB */}
      <AiFab surveyId={survey.id} educationType={survey.education_type || ""} templates={[]} onQuestionsAdded={refresh} />
    </div>
  );
}
