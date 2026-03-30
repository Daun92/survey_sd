"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Check, ChevronRight, Wand2, RotateCcw, Send, Sparkles,
  CheckCircle2, Circle, Minus,
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
  const categoryGroups = wizardQuestions.reduce<Record<string, WizardQuestion[]>>((acc, q) => {
    const cat = q.category || "기타";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(q);
    return acc;
  }, {});

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

  function updateQuestionText(order: number, text: string) {
    setWizardQuestions((prev) =>
      prev.map((q) =>
        q.questionOrder === order
          ? { ...q, questionText: text, modified: text !== q.originalText }
          : q
      )
    );
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
    setChatMessages((prev) => [
      ...prev,
      { role: "system", text: `"${text}" 문항을 [${cat}] 카테고리에 추가했습니다.` },
    ]);
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
    setChatMessages((prev) => [
      ...prev,
      { role: "system", text: "템플릿 원본으로 초기화했습니다." },
    ]);
  }

  // Chat command processing
  function handleChat() {
    const input = chatInput.trim();
    if (!input) return;
    setChatMessages((prev) => [...prev, { role: "user", text: input }]);
    setChatInput("");

    // Simple command parsing
    const lower = input.toLowerCase();
    if (lower.includes("교육내용") && (lower.includes("빼") || lower.includes("제거") || lower.includes("삭제"))) {
      toggleCategory("교육내용");
      setChatMessages((prev) => [...prev, { role: "system", text: "교육내용 카테고리 문항을 토글했습니다." }]);
    } else if (lower.includes("강사") && (lower.includes("빼") || lower.includes("제거") || lower.includes("삭제"))) {
      toggleCategory("강사");
      setChatMessages((prev) => [...prev, { role: "system", text: "강사 카테고리 문항을 토글했습니다." }]);
    } else if (lower.includes("운영") && (lower.includes("빼") || lower.includes("제거") || lower.includes("삭제"))) {
      toggleCategory("운영");
      setChatMessages((prev) => [...prev, { role: "system", text: "운영 카테고리 문항을 토글했습니다." }]);
    } else if (lower.includes("주관식") && (lower.includes("빼") || lower.includes("제거") || lower.includes("삭제"))) {
      toggleCategory("주관식");
      setChatMessages((prev) => [...prev, { role: "system", text: "주관식 카테고리 문항을 토글했습니다." }]);
    } else if (lower.includes("초기화") || lower.includes("원복") || lower.includes("리셋")) {
      resetToOriginal();
    } else if (lower.includes("추가") || lower.includes("넣어")) {
      // Try to extract a question text from the input
      const match = input.match(/[""'](.+?)[""']/);
      if (match) {
        const cat = lower.includes("주관식") ? "주관식" :
          lower.includes("강사") ? "강사" :
          lower.includes("운영") ? "운영" :
          lower.includes("만족도") ? "전반적만족도" : "교육내용";
        addSuggestion(cat, match[1]);
      } else {
        setChatMessages((prev) => [...prev, {
          role: "system",
          text: `문항을 추가하려면 따옴표로 감싸주세요. 예: "교육 난이도는 적절하였습니까?" 추가해줘`,
        }]);
      }
    } else {
      setChatMessages((prev) => [...prev, {
        role: "system",
        text: `사용 가능한 명령:\n• "[카테고리] 빼줘" — 카테고리 전체 토글\n• ""문항 내용" 추가해줘" — 새 문항 추가\n• "초기화" — 템플릿 원본으로 복원\n\n또는 아래 카테고리를 펼쳐 직접 수정하세요.`,
      }]);
    }
  }

  // Apply to editor
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

  const enabledCount = wizardQuestions.filter((q) => q.enabled).length;
  const modifiedCount = wizardQuestions.filter((q) => q.modified).length;

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
          {/* Step 1: Template Selection */}
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
            </div>
          )}

          {/* Step 2: Customize */}
          {step === "customize" && (
            <div className="py-4 space-y-4">
              {/* Summary bar */}
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="secondary">{enabledCount}/{wizardQuestions.length} 문항 선택</Badge>
                {modifiedCount > 0 && (
                  <Badge variant="outline">{modifiedCount}개 수정됨</Badge>
                )}
                <div className="flex-1" />
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetToOriginal}>
                  <RotateCcw className="h-3 w-3 mr-1" /> 초기화
                </Button>
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
                        {qs.map((q) => (
                          <div
                            key={q.questionOrder}
                            className={`flex gap-2 items-start rounded p-2 text-sm ${
                              q.enabled ? "bg-accent/30" : "bg-muted/30 opacity-60"
                            }`}
                          >
                            <button
                              onClick={() => toggleQuestion(q.questionOrder)}
                              className="mt-0.5 shrink-0"
                            >
                              {q.enabled ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <Textarea
                                value={q.questionText}
                                onChange={(e) => updateQuestionText(q.questionOrder, e.target.value)}
                                rows={1}
                                className="min-h-[32px] resize-none text-xs"
                                disabled={!q.enabled}
                              />
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground">
                                  {q.questionType === "rating_5" ? "5점 척도" :
                                   q.questionType === "text" ? "주관식" : q.questionType}
                                </span>
                                {q.modified && (
                                  <span className="text-[10px] text-amber-500">수정됨</span>
                                )}
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
                    placeholder='예: "강사 카테고리 빼줘" 또는 ""교육 난이도 문항" 추가"'
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
                <Button size="sm" className="flex-1" onClick={() => setStep("review")}>
                  검토하기 <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{enabledCount}개 문항</Badge>
                {modifiedCount > 0 && <Badge variant="outline">{modifiedCount}개 수정</Badge>}
                {existingQuestionCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    기존 {existingQuestionCount}개 문항 대체됨
                  </Badge>
                )}
              </div>

              {Object.entries(categoryGroups).map(([cat, qs]) => {
                const enabled = qs.filter((q) => q.enabled);
                if (enabled.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{cat}</p>
                    {enabled.map((q, i) => (
                      <div key={q.questionOrder} className="flex items-start gap-2 py-1">
                        <Minus className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                        <span className="text-xs">
                          {q.questionText}
                          {q.modified && <span className="text-amber-500 ml-1">(수정됨)</span>}
                        </span>
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
