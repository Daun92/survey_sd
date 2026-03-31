"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Users, CheckCircle2, XCircle } from "lucide-react";

interface TrainingRecord {
  id: number;
  customerId: number;
  trainingYear: number;
  trainingMonth: number;
  hasTraining: boolean;
  trainingName: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  notes: string | null;
  customer: {
    id: number;
    companyName: string;
    contactName: string | null;
    serviceType: { name: string };
  };
  serviceType: { name: string };
}

interface Summary {
  total: number;
  hasTraining: number;
  noTraining: number;
  byVerifier: Record<string, { total: number; verified: number }>;
}

export default function TrainingPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/training?year=${year}&month=${month}`);
    const data = await res.json();
    setRecords(data.records);
    setSummary(data.summary);
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("year", String(year));
    formData.append("month", String(month));

    const res = await fetch("/api/training/import", {
      method: "POST",
      body: formData,
    });
    const result = await res.json();

    if (res.ok) {
      toast.success(`${result.success}건 임포트 완료 (실패: ${result.failed}건)`);
      fetchData();
    } else {
      toast.error(result.error || "임포트 실패");
    }
    e.target.value = "";
  }

  // 이전 월 교육 실시 여부를 조사하는 구조 (예: 3월 조사 = 2월 교육 실시 여부)
  const trainingMonthLabel = month === 1 ? `${year - 1}년 12월` : `${year}년 ${month - 1}월`;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">교육 실시 여부 확인</h1>
          <p className="text-muted-foreground">
            {trainingMonthLabel} 교육 실시 여부 취합
          </p>
        </div>
        <div className="flex gap-2">
          <label className={buttonVariants({ variant: "outline", size: "sm", className: "cursor-pointer" })}>
            <Upload className="mr-2 h-4 w-4" />
            Excel 임포트
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
          </label>
          <Link
            href="/training/target-list"
            className={buttonVariants({ size: "sm" })}
          >
            <Users className="mr-2 h-4 w-4" />
            대상자 리스트
          </Link>
        </div>
      </div>

      {/* 년/월 선택 */}
      <div className="flex gap-4 items-center">
        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={(v) => v && setMonth(Number(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">전체</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">교육 실시</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{summary.hasTraining}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">미실시</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.noTraining}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>회사명</TableHead>
                <TableHead>서비스유형</TableHead>
                <TableHead>교육 실시</TableHead>
                <TableHead>교육과정명</TableHead>
                <TableHead>확인 담당자</TableHead>
                <TableHead>확인일시</TableHead>
                <TableHead>비고</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    해당 월의 교육 실시 여부 데이터가 없습니다. Excel 임포트로 데이터를 추가해주세요.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.customer.companyName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.serviceType.name}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.hasTraining ? (
                        <Badge className="bg-green-500/10 text-green-500">실시</Badge>
                      ) : (
                        <Badge variant="outline">미실시</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{r.trainingName}</TableCell>
                    <TableCell>{r.verifiedBy}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.verifiedAt ? new Date(r.verifiedAt).toLocaleDateString("ko-KR") : "-"}
                    </TableCell>
                    <TableCell className="text-sm">{r.notes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
