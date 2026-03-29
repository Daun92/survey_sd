"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Users, Layers, Link2, ExternalLink, QrCode, ChevronDown, ChevronRight, Pencil, Eye, X } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import AiFab from "./ai-fab";
import { reorderQuestions, updateQuestionSection } from "./actions";
import { CopyUrlButton } from "./CopyUrlButton";

import { type EditorProps, type SurveySettings, type PanelMode, type PreviewTab, type Question } from "./components/types";
import { SurveyInfoEditor } from "./components/SurveyInfoEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { SortableQuestionRow } from "./components/SortableQuestionRow";
import { DeleteSurveyButton } from "./components/DeleteSurveyButton";
import { DuplicateSurveyButton } from "./components/DuplicateSurveyButton";
import { RightPanel } from "./components/RightPanel";

export default function SurveyEditor({ survey, questions, submissionCount }: EditorProps) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  // ─── State ───
  const [panelMode, setPanelMode] = useState<PanelMode>("preview");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("landing");
  const [liveSettings, setLiveSettings] = useState<SurveySettings>(() => (survey.settings as SurveySettings) ?? {});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [addToSection, setAddToSection] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);

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

    const draggedQuestion = questions[oldIndex];
    const targetQuestion = questions[newIndex];

    // 섹션 간 이동 감지
    const oldSection = draggedQuestion.section || "기타";
    const newSection = targetQuestion.section || "기타";

    const reordered = arrayMove(questions, oldIndex, newIndex);
    try {
      await reorderQuestions(survey.id, reordered.map((q, idx) => ({ id: q.id, sort_order: idx })));
      // 섹션이 다르면 섹션 필드도 업데이트
      if (oldSection !== newSection) {
        await updateQuestionSection(draggedQuestion.id, survey.id, newSection);
      }
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

  const sectionNames = Object.keys(sections);

  // ─── Handlers ───
  const handleSelectQuestion = (id: string) => {
    setEditingQuestionId(id);
    setEditingSectionName(null);
    setPanelMode("edit");
  };

  const handleSelectSection = (sectionName: string) => {
    setEditingSectionName(sectionName);
    setEditingQuestionId(null);
    setPanelMode("section_edit");
  };

  const handleAddToSection = (sectionName: string) => {
    setAddToSection(sectionName);
    setEditingQuestionId(null);
    setEditingSectionName(null);
    setPanelMode("add");
  };

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  };

  const handlePanelSaved = () => {
    setPanelMode("preview");
    setPreviewTab("questions");
    setEditingQuestionId(null);
    setEditingSectionName(null);
    setAddToSection(null);
    refresh();
  };

  const handlePanelCancel = () => {
    setPanelMode("preview");
    setEditingQuestionId(null);
    setEditingSectionName(null);
    setAddToSection(null);
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
              <span className="text-sm text-stone-600"><strong className="text-stone-800">{sectionNames.length}</strong> 섹션</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <DuplicateSurveyButton surveyId={survey.id} />
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

        {/* Question List — Section Accordion */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">설문 문항</h2>
            <button
              onClick={() => { setPanelMode("add"); setEditingQuestionId(null); setEditingSectionName(null); setAddToSection(null); }}
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
                  {Object.entries(sections).map(([sectionName, sectionQuestions]) => {
                    const isCollapsed = collapsedSections.has(sectionName);
                    const isSectionSelected = editingSectionName === sectionName && panelMode === "section_edit";
                    const intro = liveSettings.section_intros?.[sectionName];
                    const introColor = intro?.color || "teal";
                    const colorDotClass: Record<string, string> = {
                      teal: "bg-teal-500", blue: "bg-blue-500", amber: "bg-amber-500", rose: "bg-rose-500", violet: "bg-violet-500",
                    };

                    return (
                      <div key={sectionName}>
                        {/* Section Header — Accordion */}
                        <div
                          className={`flex items-center gap-2 px-4 py-2.5 border-b border-stone-100 cursor-pointer select-none transition-colors ${
                            isSectionSelected ? "bg-teal-50/60" : "bg-stone-50/80 hover:bg-stone-100/60"
                          }`}
                        >
                          <button
                            onClick={() => toggleSection(sectionName)}
                            className="text-stone-400 hover:text-stone-600 shrink-0"
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>

                          <div
                            className="flex-1 flex items-center gap-2 min-w-0"
                            onClick={() => toggleSection(sectionName)}
                          >
                            {(intro?.title || intro?.description) && (
                              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colorDotClass[introColor] || colorDotClass.teal}`} title="인터스티셜 설정됨" />
                            )}
                            <span className="text-[13px] font-semibold text-stone-700 truncate">{sectionName}</span>
                            <span className="text-[11px] text-stone-400 shrink-0">({sectionQuestions.length})</span>
                          </div>

                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelectSection(sectionName); }}
                            className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                              isSectionSelected
                                ? "bg-teal-100 text-teal-700"
                                : "text-stone-400 hover:bg-stone-200 hover:text-stone-600"
                            }`}
                            title="섹션 편집"
                          >
                            <Pencil size={11} /> 편집
                          </button>
                        </div>

                        {/* Section Questions — Collapsible */}
                        {!isCollapsed && (
                          <>
                            {(() => {
                              let displayNum = 0;
                              return sectionQuestions.map((question) => {
                                const isInfo = question.question_type === "info_block";
                                if (!isInfo) displayNum++;
                                return (
                                  <SortableQuestionRow
                                    key={question.id}
                                    question={question}
                                    index={question._globalIndex}
                                    displayOrder={isInfo ? null : displayNum}
                                    isSelected={editingQuestionId === question.id && panelMode === "edit"}
                                    onSelect={handleSelectQuestion}
                                  />
                                );
                              });
                            })()}
                            {/* 섹션 내 문항 추가 버튼 */}
                            <div className="px-4 py-2 border-b border-stone-100">
                              <button
                                onClick={() => handleAddToSection(sectionName)}
                                className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-stone-200 px-3 py-1.5 text-[11px] text-stone-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/50 transition-colors"
                              >
                                <Plus size={11} /> 이 섹션에 문항 추가
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
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
              <span className="text-sm text-stone-600 truncate font-mono flex-1">/s/{survey.url_token}</span>
              <CopyUrlButton urlToken={survey.url_token} />
              <a href={`/s/${survey.url_token}`} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors" title="새 탭에서 열기">
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel (desktop) ── */}
      <div className="hidden lg:block w-[400px] shrink-0 self-stretch">
        <RightPanel
          panelMode={panelMode}
          previewTab={previewTab}
          onPreviewTabChange={setPreviewTab}
          surveyId={survey.id}
          surveyTitle={survey.title}
          surveyDescription={survey.description || ""}
          questions={questions}
          liveSettings={liveSettings}
          editingQuestion={editingQuestion}
          editingSectionName={editingSectionName}
          editingSectionQuestionCount={editingSectionName ? (sections[editingSectionName]?.length ?? 0) : 0}
          sectionNames={sectionNames}
          defaultSection={addToSection}
          nextSortOrder={nextSortOrder}
          onSaved={handlePanelSaved}
          onCancel={handlePanelCancel}
          onDeleted={handlePanelSaved}
        />
      </div>

      {/* ── Mobile Panel Modal ── */}
      {mobilePanel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobilePanel(false)} />
          <div className="absolute inset-x-0 bottom-0 top-12 bg-white rounded-t-2xl overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-stone-800">미리보기 · 편집</span>
              <button onClick={() => setMobilePanel(false)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
            </div>
            <RightPanel
              panelMode={panelMode}
              previewTab={previewTab}
              onPreviewTabChange={setPreviewTab}
              surveyId={survey.id}
              surveyTitle={survey.title}
              surveyDescription={survey.description || ""}
              questions={questions}
              liveSettings={liveSettings}
              editingQuestion={editingQuestion}
              editingSectionName={editingSectionName}
              editingSectionQuestionCount={editingSectionName ? (sections[editingSectionName]?.length ?? 0) : 0}
              sectionNames={sectionNames}
              defaultSection={addToSection}
              nextSortOrder={nextSortOrder}
              onSaved={() => { handlePanelSaved(); setMobilePanel(false); }}
              onCancel={() => { handlePanelCancel(); setMobilePanel(false); }}
              onDeleted={() => { handlePanelSaved(); setMobilePanel(false); }}
            />
          </div>
        </div>
      )}

      {/* Mobile FAB — 미리보기/편집 열기 */}
      <button
        onClick={() => setMobilePanel(true)}
        className="fixed bottom-6 right-6 z-40 lg:hidden flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700 transition-colors"
        title="미리보기"
      >
        <Eye size={20} />
      </button>

      {/* AI FAB */}
      <AiFab surveyId={survey.id} educationType={survey.education_type || ""} templates={[]} onQuestionsAdded={refresh} />
    </div>
  );
}
