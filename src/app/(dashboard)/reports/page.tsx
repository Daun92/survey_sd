"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceTypeCompareChart, CategoryRadarChart } from "@/components/charts/satisfaction-chart";
import { BarChart3, FileText, Download } from "lucide-react";
import { DeprecatedPageBanner } from "@/components/layout/deprecated-banner";

interface SurveyStat {
  surveyId: number;
  title: string;
  surveyYear: number;
  surveyMonth: number;
  serviceType: string;
  overallAverage: number;
  totalDistributions: number;
  totalResponses: number;
  responseRate: number;
  categoryStats: Array<{ category: string; average: number }>;
}

interface ReportData {
  overall: { average: number; totalSurveys: number; totalResponses: number; totalDistributions: number } | null;
  serviceTypeStats: Array<{ serviceType: string; average: number; totalResponses: number }>;
  surveys: SurveyStat[];
}

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState("all");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (year !== "all") params.set("year", year);
    if (month !== "all") params.set("month", month);

    fetch(`/api/reports/stats?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month]);

  return (
    <div className="space-y-6">
      <DeprecatedPageBanner
        targetPath="/admin/reports"
        targetLabel="교육 리포트 관리자"
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">리포트</h1>
          <p className="text-muted-foreground">설문 결과 분석 및 통계</p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports/annual" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <BarChart3 className="mr-2 h-4 w-4" />
            연간 결산
          </Link>
          <a
            href={`/api/reports/generate-ppt?year=${year}${month !== "all" ? `&month=${month}` : ""}`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileText className="mr-2 h-4 w-4" />
            PPT 내보내기
          </a>
          <a
            href={`/api/reports/export?year=${year}${month !== "all" ? `&month=${month}` : ""}`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="mr-2 h-4 w-4" />
            Excel 내보내기
          </a>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-4">
        <Select value={year} onValueChange={(v) => v && setYear(v)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {[2024, 2025, 2026].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month} onValueChange={(v) => v && setMonth(v)}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
      ) : !data?.overall ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>해당 기간의 응답 데이터가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 전체 요약 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">전체 평균 만족도</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{data.overall.average.toFixed(2)}<span className="text-sm text-muted-foreground ml-1">/5</span></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">설문 수</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{data.overall.totalSurveys}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">총 응답</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{data.overall.totalResponses}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">총 배포</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{data.overall.totalDistributions}</div></CardContent>
            </Card>
          </div>

          {/* 서비스유형별 비교 */}
          {data.serviceTypeStats.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">서비스유형별 만족도 비교</CardTitle></CardHeader>
              <CardContent>
                <ServiceTypeCompareChart data={data.serviceTypeStats} />
              </CardContent>
            </Card>
          )}

          {/* 설문별 목록 */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">설문별 상세</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {data.surveys.map((s) => (
                <Card key={s.surveyId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base leading-tight">{s.title}</CardTitle>
                      <Badge variant="secondary">{s.serviceType}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="text-lg font-bold">{s.overallAverage.toFixed(2)}</div>
                        <div className="text-muted-foreground">평균</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{s.totalResponses}</div>
                        <div className="text-muted-foreground">응답</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{s.responseRate}%</div>
                        <div className="text-muted-foreground">응답률</div>
                      </div>
                    </div>
                    {s.categoryStats.length >= 3 && (
                      <CategoryRadarChart data={s.categoryStats} />
                    )}
                    <Link
                      href={`/reports/${s.surveyId}`}
                      className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
                    >
                      <BarChart3 className="mr-2 h-4 w-4" />
                      상세 보기
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
