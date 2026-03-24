"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { QuestionRenderer } from "@/components/forms/question-renderer";
import { CheckCircle2, AlertCircle, ClipboardList } from "lucide-react";

interface Question {
  id: number;
  order: number;
  text: string;
  type: string;
  category: string | null;
  required: boolean;
  options: string[] | null;
}

interface SurveyData {
  survey: {
    id: number;
    title: string;
    serviceType: string;
    surveyYear: number;
    surveyMonth: number;
  };
  questions: Question[];
  customer: { companyName: string; contactName: string | null };
}

type PageState = "loading" | "ready" | "submitting" | "done" | "error";

export default function RespondPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<PageState>("loading");
  const [data, setData] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`/api/respond/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setState("error");
          setErrorMessage(json.message || "오류가 발생했습니다");
          return;
        }
        setData(json);
        setState("ready");
      })
      .catch(() => {
        setState("error");
        setErrorMessage("서버에 연결할 수 없습니다");
      });
  }, [token]);

  function validate(): boolean {
    if (!data) return false;
    const errors = new Set<number>();
    for (const q of data.questions) {
      if (q.required && !answers[q.id]?.trim()) {
        errors.add(q.id);
      }
    }
    setValidationErrors(errors);
    return errors.size === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      // 첫 번째 미응답 문항으로 스크롤
      const firstError = document.querySelector("[data-validation-error]");
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setState("submitting");

    const res = await fetch(`/api/respond/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: Object.entries(answers)
          .filter(([, v]) => v.trim())
          .map(([qId, value]) => ({ questionId: parseInt(qId), value })),
      }),
    });

    if (res.ok) {
      setState("done");
    } else {
      const err = await res.json();
      setState("error");
      setErrorMessage(err.error || "제출 중 오류가 발생했습니다");
    }
  }

  // 진행률 계산
  const progress = data
    ? Math.round((Object.keys(answers).filter((k) => answers[parseInt(k)]?.trim()).length / data.questions.length) * 100)
    : 0;

  // 로딩 상태
  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <ClipboardList className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">설문을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">{errorMessage}</p>
            <p className="text-sm text-muted-foreground">
              문의사항이 있으시면 담당자에게 연락해 주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 완료 상태
  if (state === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="text-xl font-bold">설문 완료! 감사합니다</h2>
            <p className="text-muted-foreground">
              귀중한 시간을 내어 응답해 주셔서 감사합니다.<br />
              응답하신 내용은 서비스 개선에 소중하게 활용하겠습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 응답 폼
  return (
    <div className="min-h-screen bg-background">
      {/* 진행률 바 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="container max-w-2xl mx-auto flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {data!.survey.title}
          </span>
          <span className="text-xs font-medium">{progress}%</span>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* 설문 헤더 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{data!.survey.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              안녕하세요, <span className="font-medium text-foreground">{data!.customer.companyName}</span>{" "}
              {data!.customer.contactName && <span>{data!.customer.contactName}님</span>}.
            </p>
            <p className="text-sm text-muted-foreground">
              {data!.survey.serviceType} 서비스에 대한 만족도 설문입니다. 솔직한 의견을 부탁드립니다.
            </p>
            <p className="text-xs text-muted-foreground">
              소요 시간: 약 3분 | 전체 {data!.questions.length}문항
            </p>
          </CardContent>
        </Card>

        {/* 문항들 - 카테고리별 그룹 */}
        {(() => {
          const questions = data!.questions;
          let currentCategory = "";

          return questions.map((q, idx) => {
            const showCategory = q.category && q.category !== currentCategory;
            if (q.category) currentCategory = q.category;
            const hasError = validationErrors.has(q.id);

            return (
              <div key={q.id}>
                {showCategory && (
                  <>
                    <Separator className="my-6" />
                    <h3 className="text-sm font-semibold text-primary mb-4">
                      {q.category}
                    </h3>
                  </>
                )}
                <div
                  className={`rounded-lg p-4 transition-colors ${
                    hasError ? "bg-red-500/5 ring-1 ring-red-500/20" : ""
                  }`}
                  {...(hasError ? { "data-validation-error": true } : {})}
                >
                  <QuestionRenderer
                    question={q}
                    value={answers[q.id] || ""}
                    onChange={(v) => {
                      setAnswers({ ...answers, [q.id]: v });
                      if (validationErrors.has(q.id)) {
                        const next = new Set(validationErrors);
                        next.delete(q.id);
                        setValidationErrors(next);
                      }
                    }}
                    index={idx}
                  />
                  {hasError && (
                    <p className="ml-6 mt-2 text-xs text-red-500">이 문항은 필수입니다</p>
                  )}
                </div>
              </div>
            );
          });
        })()}

        {/* 제출 */}
        <Separator />
        <div className="flex justify-center pb-12">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={state === "submitting"}
            className="px-12"
          >
            {state === "submitting" ? "제출 중..." : "설문 제출하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
