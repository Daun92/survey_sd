"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Wand2 } from "lucide-react";
import WizardPanel, { type ExportedQuestion } from "@/components/survey/wizard-panel";

interface Question {
  id: number;
  questionOrder: number;
  questionText: string;
  questionType: string;
  category: string | null;
  isRequired: boolean;
  optionsJson: string | null;
}

interface Survey {
  id: number;
  title: string;
  surveyYear: number;
  surveyMonth: number;
  status: string;
  showProjectName: boolean;
  internalLabel: string | null;
  description: string | null;
  serviceType: { id: number; name: string };
  questions: Question[];
  _count: { distributions: number; responses: number };
}

const questionTypes = [
  { value: "rating_5", label: "5점 척도" },
  { value: "rating_10", label: "10점 척도" },
  { value: "text", label: "주관식" },
  { value: "single_choice", label: "단일 선택" },
  { value: "multi_choice", label: "복수 선택" },
];

const categories = [
  "교육내용", "강사", "운영", "전반적만족도", "주관식",
  "콘텐츠", "LMS", "기술지원", "결과보고", "커뮤니케이션",
  "전문성", "플랫폼", "성과",
];

export default function LegacyEditor({ surveyId }: { surveyId: string }) {
  const id = surveyId;
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const fetchSurvey = useCallback(async () => {
    const res = await fetch(`/api/surveys/${id}`);
    if (!res.ok) { router.push("/surveys"); return; }
    const data = await res.json();
    setSurvey(data);
    setQuestions(data.questions);
  }, [id, router]);

  useEffect(() => { fetchSurvey(); }, [fetchSurvey]);

  function updateQuestion(idx: number, field: keyof Question, value: Question[keyof Question]) {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuestions(updated);
    setHasChanges(true);
  }

  function addQuestion() {
    const maxOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.questionOrder)) : 0;
    setQuestions([
      ...questions,
      {
        id: -Date.now(),
        questionOrder: maxOrder + 1,
        questionText: "",
        questionType: "rating_5",
        category: null,
        isRequired: true,
        optionsJson: null,
      },
    ]);
    setHasChanges(true);
  }

  function removeQuestion(idx: number) {
    const q = questions[idx];
    if (q.id > 0) {
      fetch(`/api/surveys/${id}/questions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id }),
      });
    }
    setQuestions(questions.filter((_, i) => i !== idx));
    setHasChanges(true);
  }

  function moveQuestion(idx: number, direction: -1 | 1) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    updated.forEach((q, i) => { q.questionOrder = (i + 1) * 10; });
    setQuestions(updated);
    setHasChanges(true);
  }

  async function saveQuestions() {
    const newQuestions = questions.filter((q) => q.id < 0);
    const existingQuestions = questions.filter((q) => q.id > 0);

    if (existingQuestions.length > 0) {
      await fetch(`/api/surveys/${id}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: existingQuestions }),
      });
    }

    for (const q of newQuestions) {
      await fetch(`/api/surveys/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      });
    }

    toast.success("문항이 저장되었습니다");
    setHasChanges(false);
    fetchSurvey();
  }

  async function updateSurveyInfo(field: string, value: string) {
    await fetch(`/api/surveys/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    toast.success("설문 정보가 수정되었습니다");
    fetchSurvey();
  }

  function handleWizardApply(exported: ExportedQuestion[]) {
    const newQuestions: Question[] = exported.map((q, idx) => ({
      id: -(Date.now() + idx),
      questionOrder: q.questionOrder,
      questionText: q.questionText,
      questionType: q.questionType,
      category: q.category,
      isRequired: q.isRequired,
      optionsJson: q.optionsJson,
    }));
    setQuestions(newQuestions);
    setHasChanges(true);
    toast.success(`마법사에서 ${exported.length}개 문항이 적용되었습니다. "문항 저장"을 눌러 확정하세요.`);
  }

  if (!survey) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/surveys")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> 목록
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{survey.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{survey.serviceType.name}</Badge>
            <span className="text-sm text-muted-foreground">
              {survey.surveyYear}년 {survey.surveyMonth}월
            </span>
            <Badge variant="outline">{survey.status}</Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => setWizardOpen(true)}>
          <Wand2 className="mr-2 h-4 w-4" />
          설문 마법사
        </Button>
        {hasChanges && (
          <Button onClick={saveQuestions}>
            <Save className="mr-2 h-4 w-4" />
            문항 저장
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">설문 기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>설문 제목</Label>
              <Input
                defaultValue={survey.title}
                onBlur={(e) => {
                  if (e.target.value !== survey.title) {
                    updateSurveyInfo("title", e.target.value);
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>내부 구분 태그</Label>
              <Input
                defaultValue={survey.internalLabel || ""}
                onBlur={(e) => {
                  if (e.target.value !== (survey.internalLabel || "")) {
                    updateSurveyInfo("internalLabel", e.target.value);
                  }
                }}
                placeholder="예: A사 리더십 1기"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>상태</Label>
              <Select
                value={survey.status}
                onValueChange={(v) => v && updateSurveyInfo("status", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">초안</SelectItem>
                  <SelectItem value="distributing">배포중</SelectItem>
                  <SelectItem value="collecting">수집중</SelectItem>
                  <SelectItem value="closed">마감</SelectItem>
                  <SelectItem value="reported">보고완료</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>응답자에게 프로젝트명 표시</Label>
              <p className="text-xs text-muted-foreground">
                이메일 및 설문 시작 화면에 교육과정/프로젝트명을 노출합니다
              </p>
            </div>
            <Switch
              checked={survey.showProjectName}
              onCheckedChange={(checked) => updateSurveyInfo("showProjectName", String(checked))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">설문 문항 ({questions.length}개)</CardTitle>
          <Button size="sm" variant="outline" onClick={addQuestion}>
            <Plus className="mr-1 h-4 w-4" /> 문항 추가
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              문항이 없습니다. 문항 추가 버튼을 클릭하세요.
            </p>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="flex gap-3 items-start rounded-lg border border-border p-3">
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() => moveQuestion(idx, -1)}
                  >
                    ▲
                  </button>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={idx === questions.length - 1}
                    onClick={() => moveQuestion(idx, 1)}
                  >
                    ▼
                  </button>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground font-mono w-6">
                      {idx + 1}.
                    </span>
                    <Textarea
                      value={q.questionText}
                      onChange={(e) => updateQuestion(idx, "questionText", e.target.value)}
                      rows={1}
                      className="flex-1 min-h-[36px] resize-none"
                      placeholder="문항 내용을 입력하세요"
                    />
                  </div>
                  <div className="flex gap-2 items-center ml-8">
                    <Select
                      value={q.questionType}
                      onValueChange={(v) => v && updateQuestion(idx, "questionType", v)}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={q.category || "none"}
                      onValueChange={(v) => updateQuestion(idx, "category", v === "none" ? null : v)}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue placeholder="카테고리" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">없음</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.isRequired}
                        onChange={(e) => updateQuestion(idx, "isRequired", e.target.checked)}
                        className="rounded"
                      />
                      필수
                    </label>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive shrink-0"
                  onClick={() => removeQuestion(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}

          {questions.length > 0 && (
            <>
              <Separator />
              <div className="flex justify-between items-center">
                <Button size="sm" variant="outline" onClick={addQuestion}>
                  <Plus className="mr-1 h-4 w-4" /> 문항 추가
                </Button>
                {hasChanges && (
                  <Button onClick={saveQuestions}>
                    <Save className="mr-2 h-4 w-4" /> 문항 저장
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
