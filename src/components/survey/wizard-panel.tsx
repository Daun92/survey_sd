"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Check, ChevronRight, ChevronUp, ChevronDown, Wand2, RotateCcw,
  Send, Sparkles, CheckCircle2, Circle, Minus, Copy, Trash2,
  Plus, X, Clock, BarChart3, ListChecks,
} from "lucide-react";

// ============================
// Types
// ============================
interface TemplateQuestion {
  questionOrder: number;
  questionText: string;
  questionType: string;
  category: string;
  isRequired: boolean;
  options?: string[] | null;
}

interface Template {
  id: number;
  templateName: string;
  serviceTypeId: number;
  questionsJson: string;
  serviceType: { id: number; name: string };
}

interface WizardQuestion extends TemplateQuestion {
  enabled: boolean;
  modified: boolean;
  originalText?: string;
}

export interface ExportedQuestion {
  questionOrder: number;
  questionText: string;
  questionType: string;
  category: string | null;
  isRequired: boolean;
  optionsJson: string | null;
}

// ============================
// Wizard Steps
// ============================
type WizardStep = "select-template" | "customize" | "review";

const stepLabels: Record<WizardStep, string> = {
  "select-template": "템플릿 선택",
  "customize": "문항 커스터마이징",
  "review": "검토 및 적용",
};

// ============================
// Question type options (통합)
// ============================
const wizardTypeOptions = [
  { value: "rating_5", label: "5점 척도" },
  { value: "rating_10", label: "10점 척도" },
  { value: "likert_5", label: "리커트 5점" },
  { value: "likert_7", label: "리커트 7점" },
  { value: "single_choice", label: "단일 선택" },
  { value: "multi_choice", label: "복수 선택" },
  { value: "multiple_choice", label: "객관식 (복수)" },
  { value: "text", label: "주관식" },
  { value: "rating", label: "평점" },
  { value: "yes_no", label: "예/아니오" },
];

function typeLabel(type: string): string {
  return wizardTypeOptions.find((o) => o.value === type)?.label ?? type;
}

function needsOptions(type: string): boolean {
  return ["single_choice", "multi_choice", "multiple_choice"].includes(type);
}

// ============================
// Conversational suggestions per category
// ============================
const categorySuggestions: Record<string, string[]> = {
  "교육내용": [
    "교육 내용의 난이도는 적절하였습니까?",
    "교육 내용이 사전 안내와 일치하였습니까?",
    "교육 자료의 실무 활용도는 어떠합니까?",
  ],
  "강사": [
    "강사의 질의응답 처리가 적절하였습니까?",
    "강사의 시간 관리 능력에 만족하십니까?",
  ],
  "운영": [
    "교육 일정 사전 안내가 충분하였습니까?",
    "교육 후 후속 안내 및 자료 제공에 만족하십니까?",
  ],
  "전반적만족도": [
    "교육 참여 전후 역량 변화를 체감하십니까?",
    "동일 과정에 대한 재참여 의향이 있으십니까?",
  ],
  "주관식": [
    "특히 도움이 된 세션이나 내용이 있다면 알려주세요.",
    "향후 추가되었으면 하는 교육 주제가 있습니까?",
  ],
};

// ============================
// Chat command patterns
// ============================
const REMOVE_VERBS = /빼|제거|삭제|없애|제외|끄기|빼줘|빼줄래/;
const ADD_VERBS = /추가|넣어|등록|포함|넣어줘/;
const RESET_VERBS = /초기화|원복|리셋|되돌려|원래대로/;
const KEEP_ONLY_PATTERN = /만\s*(남겨|켜|보여|유지|남기|놔)/;
const REQUIRED_TOGGLE = /필수로|필수\s*해제|선택으로/;
const NUMBER_PATTERN = /(\d+)\s*번/;

// ============================
// Component
// ============================
interface WizardPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceTypeId: number;
  serviceTypeName: string;
  existingQuestionCount: number;
  onApply: (questions: ExportedQuestion[]) => void;
}

export default function WizardPanel({
  open, onOpenChange, serviceTypeId, serviceTypeName,
  existingQuestionCount, onApply,
}: WizardPanelProps) {
  const [step, setStep] = useState<WizardStep>("select-template");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [wizardQuestions, setWizardQuestions] = useState<WizardQuestion[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "system" | "user"; text: string }>>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    const res = await fetch("/api/surveys/templates");
    const data: Template[] = await res.json();
    setTemplates(data);
  }, []);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setStep("select-template");
      setWizardQuestions([]);
      setChatMessages([]);
      setSelectedTemplateId(null);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
    }
  }, [open, fetchTemplates]);

  // Template matching
  const matchingTemplates = templates.filter((t) => t.serviceTypeId === serviceTypeId);
  const allTemplates = templates;

  function selectTemplate(tmpl: Template) {
    setSelectedTemplateId(tmpl.id);
    let questions: TemplateQuestion[] = [];
    try { questions = JSON.parse(tmpl.questionsJson); } catch { /* empty */ }

    const wq: WizardQuestion[] = questions.map((q) => ({
      ...q,
      enabled: true,
      modified: false,
      originalText: q.questionText,
    }));
    setWizardQuestions(wq);

    const cats = [...new Set(questions.map((q) => q.category))];
    setChatMessages([{
      role: "system",
      text: `"${tmpl.templateName}"을 불러왔습니다. ${questions.length}개 문항, 카테고리: ${cats.join(", ")}. 아래에서 카테고리별로 문항을 켜고/끄거나 수정할 수 있습니다.`,
    }]);
    setStep("customize");
  }

  // Category grouping
  const categoryGroups = useMemo(() =>
    wizardQuestions.reduce<Record<string, WizardQuestion[]>>((acc, q) => {
      const cat = q.category || "기타";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(q);
      return acc;
    }, {}),
    [wizardQuestions]
  );

  const availableCategories = useMemo(() => Object.keys(categoryGroups), [categoryGroups]);

  // ============================
  // Question manipulation functions
  // ============================

  function toggleQuestion(order: number) {
    setWizardQuestions((prev) =>
      prev.map((q) => q.questionOrder === order ? { ...q, enabled: !q.enabled } : q)
    );
  }

  function toggleCategory(cat: string) {
    const catQs = categoryGroups[cat];
    if (!catQs) return;
    const allEnabled = catQs.every((q) => q.enabled);
    setWizardQuestions((prev) =>
      prev.map((q) => q.category === cat ? { ...q, enabled: !allEnabled } : q)
    );
  }

  function keepOnlyCategory(cat: string) {
    setWizardQuestions((prev) =>
      prev.map((q) => ({ ...q, enabled: q.category === cat }))
    );
  }

  function updateQuestionText(order: number, text: string) {
    setWizardQuestions((prev) =>
      prev.map((q) =>
        q.questionOrder === order
          ? { ...q, questionText: text, modified: text !== q.originalText }
          : q
      )
    );
  }

  function updateQuestionType(order: number, newType: string) {
    setWizardQuestions((prev) =>
      prev.map((q) => {
        if (q.questionOrder !== order) return q;
        const updated = { ...q, questionType: newType, modified: true };
        if (needsOptions(newType) && (!q.options || q.options.length === 0)) {
          updated.options = ["옵션 1", "옵션 2"];
        } else if (!needsOptions(newType)) {
          updated.options = null;
        }
        return updated;
      })
    );
  }

  function updateQuestionOption(order: number, optIdx: number, value: string) {
    setWizardQuestions((prev) =>
      prev.map((q) => {
        if (q.questionOrder !== order || !q.options) return q;
        const newOpts = [...q.options];
        newOpts[optIdx] = value;
        return { ...q, options: newOpts, modified: true };
      })
    );
  }

  function addQuestionOption(order: number) {
    setWizardQuestions((prev) =>
      prev.map((q) => {
        if (q.questionOrder !== order) return q;
        return { ...q, options: [...(q.options || []), ""], modified: true };
      })
    );
  }

  function removeQuestionOption(order: number, optIdx: number) {
    setWizardQuestions((prev) =>
      prev.map((q) => {
        if (q.questionOrder !== order || !q.options) return q;
        return { ...q, options: q.options.filter((_, i) => i !== optIdx), modified: true };
      })
    );
  }

  function duplicateQuestion(order: number) {
    setWizardQuestions((prev) => {
      const idx = prev.findIndex((q) => q.questionOrder === order);
      if (idx === -1) return prev;
      const original = prev[idx];
      const clone: WizardQuestion = {
        ...original,
        questionOrder: 0,
        questionText: original.questionText + " (복제)",
        modified: true,
        originalText: undefined,
        options: original.options ? [...original.options] : null,
      };
      const newList = [...prev];
      newList.splice(idx + 1, 0, clone);
      return newList.map((q, i) => ({ ...q, questionOrder: i + 1 }));
    });
    addSystemMessage("문항이 복제되었습니다.");
  }

  function deleteWizardQuestion(order: number) {
    setWizardQuestions((prev) => {
      const filtered = prev.filter((q) => q.questionOrder !== order);
      return filtered.map((q, i) => ({ ...q, questionOrder: i + 1 }));
    });
  }

  function moveQuestion(order: number, direction: "up" | "down") {
    setWizardQuestions((prev) => {
      const sorted = [...prev].sort((a, b) => a.questionOrder - b.questionOrder);
      const idx = sorted.findIndex((q) => q.questionOrder === order);
      if (idx === -1) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return prev;
      const temp = sorted[idx].questionOrder;
      sorted[idx] = { ...sorted[idx], questionOrder: sorted[targetIdx].questionOrder };
      sorted[targetIdx] = { ...sorted[targetIdx], questionOrder: temp };
      return sorted.sort((a, b) => a.questionOrder - b.questionOrder);
    });
  }

  function addSuggestion(cat: string, text: string) {
    const maxOrder = Math.max(0, ...wizardQuestions.map((q) => q.questionOrder));
    setWizardQuestions((prev) => [
      ...prev,
      {
        questionOrder: maxOrder + 1,
        questionText: text,
        questionType: cat === "주관식" ? "text" : "rating_5",
        category: cat,
        isRequired: cat !== "주관식",
        enabled: true,
        modified: false,
        originalText: text,
      },
    ]);
    addSystemMessage(`"${text}" 문항을 [${cat}] 카테고리에 추가했습니다.`);
  }

  function addNewCategory(catName: string) {
    if (!catName.trim()) return;
    const maxOrder = Math.max(0, ...wizardQuestions.map((q) => q.questionOrder));
    setWizardQuestions((prev) => [
      ...prev,
      {
        questionOrder: maxOrder + 1,
        questionText: "",
        questionType: "rating_5",
        category: catName.trim(),
        isRequired: true,
        enabled: true,
        modified: true,
        originalText: undefined,
      },
    ]);
    setNewCategoryName("");
    setShowNewCategoryInput(false);
    setExpandedCategory(catName.trim());
    addSystemMessage(`"${catName.trim()}" 카테고리가 추가되었습니다.`);
  }

  function resetToOriginal() {
    if (!selectedTemplateId) return;
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;
    let questions: TemplateQuestion[] = [];
    try { questions = JSON.parse(tmpl.questionsJson); } catch { /* empty */ }
    setWizardQuestions(questions.map((q) => ({
      ...q, enabled: true, modified: false, originalText: q.questionText,
    })));
    addSystemMessage("템플릿 원본으로 초기화했습니다.");
  }

  function addSystemMessage(text: string) {
    setChatMessages((prev) => [...prev, { role: "system", text }]);
  }

  // ============================
  // Chat command processing (improved parser)
  // ============================
  function handleChat() {
    const input = chatInput.trim();
    if (!input) return;
    setChatMessages((prev) => [...prev, { role: "user", text: input }]);
    setChatInput("");

    const lower = input.toLowerCase();

    // 1) Reset
    if (RESET_VERBS.test(lower)) {
      resetToOriginal();
      return;
    }

    // 2) Find matched category dynamically
    const matchedCat = availableCategories.find((cat) => lower.includes(cat.toLowerCase()));

    // 3) "~만 남겨" pattern (keep only)
    if (matchedCat && KEEP_ONLY_PATTERN.test(lower)) {
      keepOnlyCategory(matchedCat);
      addSystemMessage(`"${matchedCat}" 카테고리만 남기고 나머지를 해제했습니다.`);
      return;
    }

    // 4) Required toggle
    if (matchedCat && REQUIRED_TOGGLE.test(lower)) {
      const makeRequired = lower.includes("필수로");
      setWizardQuestions((prev) =>
        prev.map((q) => q.category === matchedCat ? { ...q, isRequired: makeRequired, modified: true } : q)
      );
      addSystemMessage(`"${matchedCat}" 카테고리 문항을 ${makeRequired ? "필수" : "선택"}으로 변경했습니다.`);
      return;
    }

    // 5) Category remove/toggle
    if (matchedCat && REMOVE_VERBS.test(lower)) {
      toggleCategory(matchedCat);
      addSystemMessage(`"${matchedCat}" 카테고리 문항을 토글했습니다.`);
      return;
    }

    // 6) Question number toggle: "3번 빼줘"
    const numMatch = lower.match(NUMBER_PATTERN);
    if (numMatch && REMOVE_VERBS.test(lower)) {
      const num = parseInt(numMatch[1], 10);
      const target = wizardQuestions.find((q) => q.questionOrder === num);
      if (target) {
        toggleQuestion(num);
        addSystemMessage(`${num}번 문항을 토글했습니다.`);
      } else {
        addSystemMessage(`${num}번 문항을 찾을 수 없습니다.`);
      }
      return;
    }

    // 7) Add question with quoted text
    if (ADD_VERBS.test(lower)) {
      const match = input.match(/[""'](.+?)[""']/);
      if (match) {
        const cat = matchedCat || (lower.includes("주관식") ? "주관식" : "교육내용");
        addSuggestion(cat, match[1]);
      } else {
        addSystemMessage(`문항을 추가하려면 따옴표로 감싸주세요. 예: "교육 난이도는 적절하였습니까?" 추가해줘`);
      }
      return;
    }

    // 8) Category add: "OO 카테고리 추가"
    if (lower.includes("카테고리") && ADD_VERBS.test(lower)) {
      const catMatch = input.match(/[""'](.+?)[""']/);
      if (catMatch) {
        addNewCategory(catMatch[1]);
      } else {
        addSystemMessage(`카테고리를 추가하려면 따옴표로 이름을 감싸주세요. 예: "기술지원" 카테고리 추가해줘`);
      }
      return;
    }

    // 9) Fallback: help
    addSystemMessage(
      `사용 가능한 명령:\n` +
      `• "[카테고리] 빼줘" — 카테고리 전체 토글\n` +
      `• "[카테고리]만 남겨줘" — 해당 카테고리만 유지\n` +
      `• "N번 빼줘" — 특정 문항 토글\n` +
      `• ""문항 내용" 추가해줘" — 새 문항 추가\n` +
      `• "[카테고리] 필수로/선택으로" — 필수 여부 변경\n` +
      `• "초기화" — 템플릿 원본으로 복원`
    );
  }

  // ============================
  // Apply to editor
  // ============================
  function handleApply() {
    const enabledQs = wizardQuestions.filter((q) => q.enabled);
    const exported: ExportedQuestion[] = enabledQs.map((q, idx) => ({
      questionOrder: (idx + 1) * 10,
      questionText: q.questionText,
      questionType: q.questionType,
      category: q.category || null,
      isRequired: q.isRequired,
      optionsJson: q.options ? JSON.stringify(q.options) : null,
    }));
    onApply(exported);
    onOpenChange(false);
  }

  // ============================
  // Statistics (for review step)
  // ============================
  const enabledCount = wizardQuestions.filter((q) => q.enabled).length;
  const modifiedCount = wizardQuestions.filter((q) => q.modified).length;

  const reviewStats = useMemo(() => {
    const enabled = wizardQuestions.filter((q) => q.enabled);
    const typeDist: Record<string, number> = {};
    enabled.forEach((q) => {
      const label = typeLabel(q.questionType);
      typeDist[label] = (typeDist[label] || 0) + 1;
    });
    const requiredCount = enabled.filter((q) => q.isRequired).length;
    const catCount = new Set(enabled.map((q) => q.category)).size;
    const estMinutes = Math.ceil((enabled.length * 30) / 60); // 문항당 30초
    return { typeDist, requiredCount, optionalCount: enabled.length - requiredCount, catCount, estMinutes };
  }, [wizardQuestions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            설문 설계 마법사
          </SheetTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            {(["select-template", "customize", "review"] as WizardStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <span className={step === s ? "text-foreground font-medium" : ""}>
                  {stepLabels[s]}
                </span>
              </div>
            ))}
          </div>
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 px-6">
          {/* ==================== Step 1: Template Selection ==================== */}
          {step === "select-template" && (
            <div className="py-4 space-y-4">
              {matchingTemplates.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    <strong>{serviceTypeName}</strong> 서비스유형에 맞는 템플릿:
                  </p>
                  {matchingTemplates.map((t) => {
                    let count = 0;
                    try { count = JSON.parse(t.questionsJson).length; } catch { /* empty */ }
                    return (
                      <button
                        key={t.id}
                        onClick={() => selectTemplate(t)}
                        className="w-full text-left rounded-lg border border-border p-4 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{t.templateName}</div>
                            <div className="text-xs text-muted-foreground mt-1">{count}개 문항</div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  현재 서비스유형({serviceTypeName})에 맞는 템플릿이 없습니다.
                </p>
              )}

              {allTemplates.filter((t) => t.serviceTypeId !== serviceTypeId).length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">다른 서비스유형 템플릿:</p>
                  {allTemplates
                    .filter((t) => t.serviceTypeId !== serviceTypeId)
                    .map((t) => {
                      let count = 0;
                      try { count = JSON.parse(t.questionsJson).length; } catch { /* empty */ }
                      return (
                        <button
                          key={t.id}
                          onClick={() => selectTemplate(t)}
                          className="w-full text-left rounded-lg border border-border/50 p-3 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm">{t.templateName}</div>
                              <div className="text-xs text-muted-foreground">
                                {t.serviceType.name} · {count}개 문항
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                </>
              )}

              {/* 빈 설문으로 시작 */}
              <Separator />
              <button
                onClick={() => {
                  setWizardQuestions([]);
                  setChatMessages([{ role: "system", text: "빈 설문으로 시작합니다. 새 카테고리와 문항을 추가해주세요." }]);
                  setStep("customize");
                }}
                className="w-full text-left rounded-lg border border-dashed border-border p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">빈 설문으로 시작</div>
                    <div className="text-xs text-muted-foreground mt-0.5">템플릿 없이 직접 문항을 구성합니다</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ==================== Step 2: Customize ==================== */}
          {step === "customize" && (
            <div className="py-4 space-y-4">
              {/* Summary bar */}
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="secondary">{enabledCount}/{wizardQuestions.length} 문항 선택</Badge>
                {modifiedCount > 0 && (
                  <Badge variant="outline">{modifiedCount}개 수정됨</Badge>
                )}
                <div className="flex-1" />
                {selectedTemplateId && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetToOriginal}>
                    <RotateCcw className="h-3 w-3 mr-1" /> 초기화
                  </Button>
                )}
              </div>

              {/* Category groups */}
              {Object.entries(categoryGroups).map(([cat, qs]) => {
                const catEnabled = qs.filter((q) => q.enabled).length;
                const isExpanded = expandedCategory === cat;
                return (
                  <div key={cat} className="rounded-lg border border-border">
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                      className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{cat}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {catEnabled}/{qs.length} 문항
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}
                        >
                          {catEnabled === qs.length ? "전체 해제" : "전체 선택"}
                        </Button>
                        <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        {qs.map((q, qIdx) => (
                          <div
                            key={q.questionOrder}
                            className={`rounded-lg p-2.5 text-sm transition-colors ${
                              q.enabled ? "bg-accent/30" : "bg-muted/30 opacity-60"
                            }`}
                          >
                            <div className="flex gap-2 items-start">
                              {/* Left: toggle + move buttons */}
                              <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
                                <button
                                  onClick={() => toggleQuestion(q.questionOrder)}
                                  className="shrink-0"
                                >
                                  {q.enabled ? (
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>
                                <button
                                  onClick={() => moveQuestion(q.questionOrder, "up")}
                                  disabled={qIdx === 0}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => moveQuestion(q.questionOrder, "down")}
                                  disabled={qIdx === qs.length - 1}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>

                              {/* Center: text + type + options */}
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <Textarea
                                  value={q.questionText}
                                  onChange={(e) => updateQuestionText(q.questionOrder, e.target.value)}
                                  rows={1}
                                  className="min-h-[32px] resize-none text-xs"
                                  disabled={!q.enabled}
                                  placeholder="문항 내용을 입력하세요"
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                  <select
                                    value={q.questionType}
                                    onChange={(e) => updateQuestionType(q.questionOrder, e.target.value)}
                                    disabled={!q.enabled}
                                    className="rounded border border-border px-1.5 py-0.5 text-[10px] bg-background focus:border-primary outline-none"
                                  >
                                    {wizardTypeOptions.map((opt) => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={q.isRequired}
                                      onChange={(e) => {
                                        setWizardQuestions((prev) =>
                                          prev.map((wq) =>
                                            wq.questionOrder === q.questionOrder
                                              ? { ...wq, isRequired: e.target.checked, modified: true }
                                              : wq
                                          )
                                        );
                                      }}
                                      disabled={!q.enabled}
                                      className="accent-primary"
                                    />
                                    필수
                                  </label>
                                  {q.modified && (
                                    <span className="text-[10px] text-amber-500">수정됨</span>
                                  )}
                                </div>

                                {/* Inline options editor */}
                                {q.enabled && needsOptions(q.questionType) && (
                                  <div className="space-y-1 pt-1">
                                    <p className="text-[10px] text-muted-foreground">선택지:</p>
                                    {(q.options || []).map((opt, optIdx) => (
                                      <div key={optIdx} className="flex items-center gap-1">
                                        <span className="text-[10px] text-muted-foreground w-4 text-right shrink-0">
                                          {optIdx + 1}.
                                        </span>
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => updateQuestionOption(q.questionOrder, optIdx, e.target.value)}
                                          placeholder={`옵션 ${optIdx + 1}`}
                                          className="flex-1 rounded border border-border px-1.5 py-0.5 text-[11px] bg-background focus:border-primary outline-none"
                                        />
                                        {(q.options?.length ?? 0) > 1 && (
                                          <button
                                            onClick={() => removeQuestionOption(q.questionOrder, optIdx)}
                                            className="text-muted-foreground hover:text-destructive"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => addQuestionOption(q.questionOrder)}
                                      className="text-[10px] text-primary hover:text-primary/80 font-medium flex items-center gap-0.5"
                                    >
                                      <Plus className="h-2.5 w-2.5" /> 선택지 추가
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Right: actions */}
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button
                                  onClick={() => duplicateQuestion(q.questionOrder)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                  title="복제"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => deleteWizardQuestion(q.questionOrder)}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Suggestions */}
                        {categorySuggestions[cat] && (
                          <div className="pt-2">
                            <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> 추가 추천 문항
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {categorySuggestions[cat]
                                .filter((s) => !wizardQuestions.some((q) => q.questionText === s))
                                .map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => addSuggestion(cat, s)}
                                    className="text-[11px] px-2 py-1 rounded-md border border-dashed border-border hover:bg-accent transition-colors text-left"
                                  >
                                    + {s.length > 30 ? s.slice(0, 30) + "…" : s}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* New category */}
              {showNewCategoryInput ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addNewCategory(newCategoryName); }}
                    placeholder="새 카테고리명"
                    className="flex-1 h-8 text-xs"
                    autoFocus
                  />
                  <Button size="sm" className="h-8 text-xs" onClick={() => addNewCategory(newCategoryName)}
                    disabled={!newCategoryName.trim()}>
                    추가
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs"
                    onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(""); }}>
                    취소
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs border-dashed"
                  onClick={() => setShowNewCategoryInput(true)}
                >
                  <Plus className="h-3 w-3 mr-1" /> 새 카테고리 추가
                </Button>
              )}

              <Separator />

              {/* Chat area */}
              <div className="space-y-2">
                <p className="text-xs font-medium flex items-center gap-1">
                  <Wand2 className="h-3 w-3" /> 대화로 수정하기
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`text-xs px-3 py-1.5 rounded-lg ${
                        msg.role === "user"
                          ? "bg-primary/10 text-foreground ml-8"
                          : "bg-muted text-muted-foreground mr-8"
                      }`}
                    >
                      {msg.text.split("\n").map((line, li) => (
                        <span key={li}>
                          {line}
                          {li < msg.text.split("\n").length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); }
                    }}
                    placeholder='예: "강사만 남겨줘" 또는 "3번 빼줘"'
                    rows={1}
                    className="flex-1 min-h-[36px] resize-none text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={handleChat} className="shrink-0">
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setStep("select-template")}>
                  이전
                </Button>
                <Button size="sm" className="flex-1" onClick={() => setStep("review")} disabled={enabledCount === 0}>
                  검토하기 <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ==================== Step 3: Review ==================== */}
          {step === "review" && (
            <div className="py-4 space-y-4">
              {/* Stats dashboard */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg border border-border p-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <ListChecks className="h-3 w-3" />
                  </div>
                  <div className="text-sm font-semibold">{enabledCount}</div>
                  <div className="text-[10px] text-muted-foreground">전체 문항</div>
                </div>
                <div className="rounded-lg border border-border p-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <BarChart3 className="h-3 w-3" />
                  </div>
                  <div className="text-sm font-semibold">{reviewStats.catCount}</div>
                  <div className="text-[10px] text-muted-foreground">카테고리</div>
                </div>
                <div className="rounded-lg border border-border p-2 text-center">
                  <div className="text-sm font-semibold">{reviewStats.requiredCount}</div>
                  <div className="text-[10px] text-muted-foreground">필수</div>
                </div>
                <div className="rounded-lg border border-border p-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <Clock className="h-3 w-3" />
                  </div>
                  <div className="text-sm font-semibold">~{reviewStats.estMinutes}분</div>
                  <div className="text-[10px] text-muted-foreground">예상 소요</div>
                </div>
              </div>

              {/* Type distribution */}
              <div className="flex flex-wrap gap-1">
                {Object.entries(reviewStats.typeDist).map(([label, count]) => (
                  <Badge key={label} variant="outline" className="text-[10px]">
                    {label} {count}
                  </Badge>
                ))}
                {modifiedCount > 0 && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                    {modifiedCount}개 수정
                  </Badge>
                )}
              </div>

              {existingQuestionCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  기존 {existingQuestionCount}개 문항 대체됨
                </Badge>
              )}

              <Separator />

              {/* Question list by category */}
              {Object.entries(categoryGroups).map(([cat, qs]) => {
                const enabled = qs.filter((q) => q.enabled);
                if (enabled.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{cat}</p>
                    {enabled.map((q) => (
                      <div key={q.questionOrder} className="flex items-start gap-2 py-1">
                        <Minus className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <span className="text-xs">{q.questionText}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{typeLabel(q.questionType)}</span>
                            {q.isRequired && <span className="text-[10px] text-primary">필수</span>}
                            {q.modified && <span className="text-[10px] text-amber-500">수정됨</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              <Separator />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setStep("customize")}>
                  이전
                </Button>
                <Button size="sm" className="flex-1" onClick={handleApply}>
                  <Check className="h-4 w-4 mr-1" />
                  {existingQuestionCount > 0 ? "기존 문항 대체하고 적용" : "에디터에 적용"}
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
