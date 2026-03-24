"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, ClipboardList, Send, BarChart3, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";

interface DashboardData {
  customerCount: number;
  surveyCount: number;
  totalDistributed: number;
  totalResponded: number;
  responseRate: number;
  averageSatisfaction: number | null;
  year: number;
  month: number;
}

interface WorkflowStep {
  step: number;
  title: string;
  status: "pending" | "in_progress" | "completed";
  detail: string;
  href: string;
}

const statusConfig = {
  completed: { label: "완료", icon: CheckCircle2, className: "text-green-500 bg-green-500/10 border-green-500/20" },
  in_progress: { label: "진행중", icon: Clock, className: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  pending: { label: "대기", icon: AlertCircle, className: "text-muted-foreground bg-muted border-border" },
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.ok ? r.json() : null).then(setData);
    fetch("/api/workflow/status").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.steps) setSteps(d.steps);
    });
  }, []);

  const year = data?.year ?? new Date().getFullYear();
  const month = data?.month ?? new Date().getMonth() + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-muted-foreground">{year}년 {month}월 CS 조사 현황</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">등록 고객사</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.customerCount ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">이번 달 설문</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.surveyCount ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">배포 / 응답</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? `${data.totalResponded} / ${data.totalDistributed}` : "-"}
            </div>
            {data && data.totalDistributed > 0 && (
              <div className="mt-1">
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${data.responseRate}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">응답률 {data.responseRate}%</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">평균 만족도</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.averageSatisfaction ? `${data.averageSatisfaction.toFixed(2)}` : "-"}
              {data?.averageSatisfaction && <span className="text-sm text-muted-foreground ml-1">/5</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 월별 워크플로우 */}
      <Card>
        <CardHeader><CardTitle>월별 워크플로우</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {steps.map((step) => {
              const config = statusConfig[step.status];
              const StatusIcon = config.icon;
              return (
                <a
                  key={step.step}
                  href={step.href}
                  className="flex items-center gap-4 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${config.className}`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{step.step}. {step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.detail}</p>
                  </div>
                  <Badge variant={step.status === "completed" ? "default" : step.status === "in_progress" ? "secondary" : "outline"}>
                    {config.label}
                  </Badge>
                </a>
              );
            })}
            {steps.length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">워크플로우 상태를 불러오는 중...</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
