"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import WizardPanel, { type ExportedQuestion } from "@/components/survey/wizard-panel";
import { BuilderTopbar } from "./BuilderTopbar";
import { BuilderOutline } from "./BuilderOutline";
import { BuilderCanvas } from "./BuilderCanvas";
import { BuilderInspector } from "./BuilderInspector";
import type { BuilderQuestion, BuilderSurvey } from "./types";

interface BuilderShellProps {
  surveyId: string;
}

export default function BuilderShell({ surveyId }: BuilderShellProps) {
  const router = useRouter();
  const [survey, setSurvey] = useState<BuilderSurvey | null>(null);
  const [questions, setQuestions] = useState<BuilderQuestion[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [previewMode, setPreviewMode] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pickedInitialSelectionRef = useRef(false);

  const fetchSurvey = useCallback(async () => {
    const res = await fetch(`/api/surveys/${surveyId}`);
    if (!res.ok) {
      router.push("/surveys");
      return;
    }
    const data = (await res.json()) as BuilderSurvey;
    setSurvey(data);
    setQuestions(data.questions);
    setDirtyIds(new Set());
  }, [surveyId, router]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  // 처음 로드 시 첫 문항 자동 선택 (한 번만).
  useEffect(() => {
    if (pickedInitialSelectionRef.current) return;
    if (questions.length > 0 && selectedId === null) {
      setSelectedId(questions[0].id);
      pickedInitialSelectionRef.current = true;
    }
  }, [questions, selectedId]);

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedId) ?? null,
    [questions, selectedId],
  );

  const pendingCount = useMemo(() => {
    const newCount = questions.filter((q) => q.id < 0).length;
    return newCount + dirtyIds.size;
  }, [questions, dirtyIds]);

  // 문항 필드 편집
  function patchQuestion<K extends keyof BuilderQuestion>(
    id: number,
    field: K,
    value: BuilderQuestion[K],
  ) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    );
    if (id > 0) {
      setDirtyIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }

  function handleInspectorChange<K extends keyof BuilderQuestion>(
    field: K,
    value: BuilderQuestion[K],
  ) {
    if (!selectedQuestion) return;
    patchQuestion(selectedQuestion.id, field, value);
  }

  function addQuestion() {
    const maxOrder =
      questions.length > 0 ? Math.max(...questions.map((q) => q.questionOrder)) : 0;
    const newQ: BuilderQuestion = {
      id: -Date.now(),
      questionOrder: maxOrder + 10,
      questionText: "",
      questionType: "rating_5",
      category: null,
      isRequired: true,
      optionsJson: null,
    };
    setQuestions((prev) => [...prev, newQ]);
    setSelectedId(newQ.id);
  }

  function duplicateQuestion() {
    if (!selectedQuestion) return;
    const idx = questions.findIndex((q) => q.id === selectedQuestion.id);
    const copy: BuilderQuestion = {
      ...selectedQuestion,
      id: -Date.now(),
      questionOrder: selectedQuestion.questionOrder + 5,
    };
    const next = [
      ...questions.slice(0, idx + 1),
      copy,
      ...questions.slice(idx + 1),
    ];
    setQuestions(next);
    setSelectedId(copy.id);
  }

  async function deleteSelected() {
    if (!selectedQuestion) return;
    const q = selectedQuestion;
    const idx = questions.findIndex((x) => x.id === q.id);

    // 기존 id(>0) → 즉시 DELETE (현행 계약)
    if (q.id > 0) {
      await fetch(`/api/surveys/${surveyId}/questions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id }),
      });
      setDirtyIds((prev) => {
        if (!prev.has(q.id)) return prev;
        const next = new Set(prev);
        next.delete(q.id);
        return next;
      });
    }

    const next = questions.filter((x) => x.id !== q.id);
    setQuestions(next);

    // 다음 선택: 같은 index 위치의 문항, 없으면 그 이전, 없으면 null
    const nextSelected =
      next[idx]?.id ?? next[idx - 1]?.id ?? null;
    setSelectedId(nextSelected);
  }

  function handleReorder(next: BuilderQuestion[]) {
    setQuestions(next);
    // 재정렬된 기존 문항의 questionOrder 변경은 저장 대상 → dirty 마킹
    setDirtyIds((prev) => {
      const merged = new Set(prev);
      next.forEach((q) => {
        if (q.id > 0) merged.add(q.id);
      });
      return merged;
    });
  }

  async function updateSurveyInfo(field: string, value: string | boolean) {
    const body: Record<string, unknown> = { [field]: value };
    const res = await fetch(`/api/surveys/${surveyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error("설문 정보 업데이트 실패");
      return;
    }
    toast.success("설문 정보가 수정되었습니다");
    // 로컬 state에 반영 (reload 없이)
    setSurvey((prev) => (prev ? ({ ...prev, [field]: value } as BuilderSurvey) : prev));
  }

  async function saveAll() {
    if (pendingCount === 0 || saving) return;
    setSaving(true);
    try {
      const newQs = questions.filter((q) => q.id < 0);
      const existingQs = questions.filter((q) => q.id > 0);

      if (existingQs.length > 0) {
        const res = await fetch(`/api/surveys/${surveyId}/questions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions: existingQs }),
        });
        if (!res.ok) throw new Error("기존 문항 저장 실패");
      }

      for (const q of newQs) {
        const res = await fetch(`/api/surveys/${surveyId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(q),
        });
        if (!res.ok) throw new Error("새 문항 저장 실패");
      }

      toast.success("문항이 저장되었습니다");
      await fetchSurvey();
      // 저장 후 선택 유지 (id 매칭이 안 되면 null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 중 오류");
    } finally {
      setSaving(false);
    }
  }

  function handleWizardApply(exported: ExportedQuestion[]) {
    const newQuestions: BuilderQuestion[] = exported.map((q, idx) => ({
      id: -(Date.now() + idx),
      questionOrder: q.questionOrder,
      questionText: q.questionText,
      questionType: q.questionType,
      category: q.category,
      isRequired: q.isRequired,
      optionsJson: q.optionsJson,
    }));
    setQuestions(newQuestions);
    setDirtyIds(new Set());
    setSelectedId(newQuestions[0]?.id ?? null);
    setWizardOpen(false);
    toast.success(
      `마법사에서 ${exported.length}개 문항이 적용되었습니다. 저장 버튼을 눌러 확정하세요.`,
    );
  }

  if (!survey) return null;

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col bg-background">
      <BuilderTopbar
        survey={survey}
        pendingCount={pendingCount}
        previewMode={previewMode}
        onTogglePreview={setPreviewMode}
        onAdd={addQuestion}
        onOpenWizard={() => setWizardOpen(true)}
        onSave={saveAll}
        onStatusChange={(v) => updateSurveyInfo("status", v)}
        onBack={() => router.push("/surveys")}
        saving={saving}
      />

      {/* 데스크탑: 3-컬럼 */}
      <div className="hidden flex-1 overflow-hidden lg:grid lg:grid-cols-[260px_1fr_340px]">
        <BuilderOutline
          questions={questions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={handleReorder}
        />
        <BuilderCanvas
          survey={survey}
          questions={questions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          previewMode={previewMode}
          onUpdateSurvey={updateSurveyInfo}
        />
        <BuilderInspector
          question={selectedQuestion}
          onChange={handleInspectorChange}
          onDelete={deleteSelected}
          onDuplicate={duplicateQuestion}
        />
      </div>

      {/* 모바일/태블릿: 탭 전환 */}
      <div className="flex-1 overflow-hidden lg:hidden">
        <Tabs defaultValue="canvas" className="flex h-full flex-col">
          <TabsList className="mx-3 mt-2 grid w-[calc(100%-1.5rem)] grid-cols-3">
            <TabsTrigger value="outline">아웃라인</TabsTrigger>
            <TabsTrigger value="canvas">캔버스</TabsTrigger>
            <TabsTrigger value="inspector">편집</TabsTrigger>
          </TabsList>
          <TabsContent value="outline" className="flex-1 overflow-hidden">
            <BuilderOutline
              questions={questions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReorder={handleReorder}
            />
          </TabsContent>
          <TabsContent value="canvas" className="flex-1 overflow-hidden">
            <BuilderCanvas
              survey={survey}
              questions={questions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              previewMode={previewMode}
              onUpdateSurvey={updateSurveyInfo}
            />
          </TabsContent>
          <TabsContent value="inspector" className="flex-1 overflow-hidden">
            <BuilderInspector
              question={selectedQuestion}
              onChange={handleInspectorChange}
              onDelete={deleteSelected}
              onDuplicate={duplicateQuestion}
            />
          </TabsContent>
        </Tabs>
      </div>

      <WizardPanel
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        serviceTypeId={survey.serviceType.id}
        serviceTypeName={survey.serviceType.name}
        existingQuestionCount={questions.length}
        onApply={handleWizardApply}
      />
    </div>
  );
}
