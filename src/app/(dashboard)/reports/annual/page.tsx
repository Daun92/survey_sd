"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceTypeCompareChart } from "@/components/charts/satisfaction-chart";
import { TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { DeprecatedPageBanner } from "@/components/layout/deprecated-banner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface MonthStat {
  month: number;
  average: number | null;
  totalResponses: number;
  responseRate: number;
  surveyCount: number;
}

interface AnnualData {
  year: number;
  annualAverage: number | null;
  prevYearAverage: number | null;
  yearOverYearChange: number | null;
  totalSurveys: number;
  totalResponses: number;
  totalDistributions: number;
  bestMonth: { month: number; average: number } | null;
  worstMonth: { month: number; average: number } | null;
  monthlyStats: MonthStat[];
  serviceTypeStats: Array<{ serviceType: string; average: number; totalResponses: number }>;
}

export default function AnnualReportPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<AnnualData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/annual?year=${year}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year]);

  const trendData = data?.monthlyStats
    .filter((m) => m.average !== null)
    .map((m) => ({ name: `${m.month}월`, average: m.average, responses: m.totalResponses }))
    || [];

  return (
    <div className="space-y-6">
      <DeprecatedPageBanner
        targetPath="/admin/reports"
        targetLabel="교육 리포트 관리자"
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">연간 결산</h1>
          <p className="text-muted-foreground">{year}년 CS 조사 종합 분석</p>
        </div>
        <div className="flex gap-2">
          <Select value={year} onValueChange={(v) => v && setYear(v)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <a
            href={`/api/reports/export?year=${year}`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="mr-2 h-4 w-4" />
            Excel
          </a>
          <a
            href={`/api/reports/generate-ppt?year=${year}&month=12`}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="mr-2 h-4 w-4" />
            PPT
          </a>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
      ) : !data ? (
        <div className="py-20 text-center text-muted-foreground">데이터가 없습니다</div>
      ) : (
        <>
          {/* 연간 요약 카드 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">연간 평균 만족도</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {data.annualAverage?.toFixed(2) ?? "-"}
                  {data.annualAverage && <span className="text-sm text-muted-foreground ml-1">/5</span>}
                </div>
                {data.yearOverYearChange !== null && (
                  <div className={`flex items-center gap-1 text-xs mt-1 ${data.yearOverYearChange > 0 ? "text-green-500" : data.yearOverYearChange < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {data.yearOverYearChange > 0 ? <TrendingUp className="h-3 w-3" /> : data.yearOverYearChange < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    전년 대비 {data.yearOverYearChange > 0 ? "+" : ""}{data.yearOverYearChange.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">총 설문</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{data.totalSurveys}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">총 응답</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{data.totalResponses}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">최고/최저 월</CardTitle></CardHeader>
              <CardContent>
                {data.bestMonth && data.worstMonth ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                      <span>{data.bestMonth.month}월 ({data.bestMonth.average.toFixed(2)})</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      <span>{data.worstMonth.month}월 ({data.worstMonth.average.toFixed(2)})</span>
                    </div>
                  </div>
                ) : <div className="text-2xl font-bold">-</div>}
              </CardContent>
            </Card>
          </div>

          {/* 월별 추이 차트 */}
          {trendData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">월별 만족도 추이</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis domain={[0, 5]} tickCount={6} fontSize={12} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(2)}점`, "평균 만족도"]}
                      contentStyle={{ background: "#18181b", border: "none", borderRadius: 8, fontSize: 13 }}
                    />
                    <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 서비스유형별 연간 비교 */}
          {data.serviceTypeStats.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">서비스유형별 연간 만족도</CardTitle></CardHeader>
              <CardContent>
                <ServiceTypeCompareChart data={data.serviceTypeStats} />
              </CardContent>
            </Card>
          )}

          {/* 월별 상세 테이블 */}
          <Card>
            <CardHeader><CardTitle className="text-sm">월별 상세</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-12">
                {data.monthlyStats.map((m) => (
                  <div key={m.month} className={`rounded-lg border p-3 text-center ${m.average ? "" : "opacity-40"}`}>
                    <div className="text-xs text-muted-foreground mb-1">{m.month}월</div>
                    <div className="text-lg font-bold">{m.average?.toFixed(1) ?? "-"}</div>
                    <div className="text-[10px] text-muted-foreground">{m.totalResponses}건</div>
                    {m.responseRate > 0 && (
                      <div className="mt-1 h-1 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${m.responseRate}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
