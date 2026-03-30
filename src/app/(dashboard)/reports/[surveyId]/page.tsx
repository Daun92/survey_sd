"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CategoryBarChart, QuestionBarChart, DistributionChart,
} from "@/components/charts/satisfaction-chart";
import { ArrowLeft, Download } from "lucide-react";

interface QuestionStat {
  questionId: number;
  questionText: string;
  questionType: string;
  category: string | null;
  questionOrder: number;
  average: number;
  count: number;
  distribution: Record<number, number>;
}

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
  categoryStats: Array<{ category: string; average: number; questionCount: number }>;
  questionStats: QuestionStat[];
}

export default function SurveyReportPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params);
  const router = useRouter();
  const [stat, setStat] = useState<SurveyStat | null>(null);
  const [vocData, setVocData] = useState<Array<{ customer: string; question: string; answer: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/reports/stats?surveyId=${surveyId}`).then((r) => r.json()),
      fetch(`/api/reports/voc?surveyId=${surveyId}`).then((r) => r.json()),
    ]).then(([statsData, voc]) => {
      setStat(statsData.surveys?.[0] || null);
      setVocData(voc.responses || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [surveyId]);

  if (loading) return <div className="py-20 text-center text-muted-foreground">로딩 중...</div>;
  if (!stat) return <div className="py-20 text-center text-muted-foreground">데이터가 없습니다</div>;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/reports")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> 목록
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{stat.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{stat.serviceType}</Badge>
            <span className="text-sm text-muted-foreground">
              {stat.surveyYear}년 {stat.surveyMonth}월
            </span>
          </div>
        </div>
        <a
          href={`/api/reports/export?surveyId=${surveyId}`}
          download
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Download className="mr-2 h-4 w-4" />
          Excel 내보내기
        </a>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">전체 평균</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stat.overallAverage.toFixed(2)}<span className="text-sm text-muted-foreground ml-1">/5</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">응답 수</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stat.totalResponses}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">배포 수</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stat.totalDistributions}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">응답률</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stat.responseRate}%</div>
            <div className="mt-1 h-2 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${stat.responseRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 카테고리별 만족도 */}
      {stat.categoryStats.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">카테고리별 만족도</CardTitle></CardHeader>
          <CardContent>
            <CategoryBarChart data={stat.categoryStats} />
          </CardContent>
        </Card>
      )}

      {/* 문항별 상세 */}
      <Card>
        <CardHeader><CardTitle className="text-sm">문항별 상세</CardTitle></CardHeader>
        <CardContent>
          <QuestionBarChart data={stat.questionStats} />
          <Separator className="my-6" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>문항</TableHead>
                <TableHead className="w-20">카테고리</TableHead>
                <TableHead className="w-16 text-center">평균</TableHead>
                <TableHead className="w-16 text-center">응답</TableHead>
                <TableHead className="w-32">분포</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stat.questionStats.map((q, i) => (
                <TableRow key={q.questionId}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-sm">{q.questionText}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{q.category}</Badge></TableCell>
                  <TableCell className="text-center font-semibold">{q.average.toFixed(2)}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{q.count}</TableCell>
                  <TableCell>
                    <DistributionChart
                      distribution={q.distribution}
                      maxScore={q.questionType === "rating_10" ? 10 : 5}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* VOC (주관식 응답) */}
      {vocData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">VOC (주관식 응답) — {vocData.length}건</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vocData.map((v, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{v.customer}</span>
                    <span className="text-xs text-muted-foreground">| {v.question}</span>
                  </div>
                  <p className="text-sm">{v.answer}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
