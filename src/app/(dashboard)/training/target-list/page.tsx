"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Target {
  customerId: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  serviceType: string;
  serviceTypeId: number;
  trainingName: string | null;
  salesRep: string | null;
  salesTeam: string | null;
}

export default function TargetListPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [targets, setTargets] = useState<Target[]>([]);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/training/target-list?year=${year}&month=${month}`);
    const data = await res.json();
    setTargets(data.targets);
    setTotal(data.total);
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CS 대상자 리스트</h1>
        <p className="text-muted-foreground">
          교육을 실시한 고객사 = 설문/인터뷰 대상 ({total}건)
        </p>
      </div>

      <div className="flex gap-4 items-center">
        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={(v) => v && setMonth(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">설문/인터뷰 대상 고객사</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>회사명</TableHead>
                <TableHead>서비스유형</TableHead>
                <TableHead>교육과정명</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead>영업담당</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    해당 월에 교육을 실시한 고객사가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                targets.map((t, i) => (
                  <TableRow key={t.customerId}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{t.companyName}</TableCell>
                    <TableCell><Badge variant="secondary">{t.serviceType}</Badge></TableCell>
                    <TableCell className="text-sm">{t.trainingName}</TableCell>
                    <TableCell>{t.contactName}</TableCell>
                    <TableCell className="text-sm">{t.email}</TableCell>
                    <TableCell className="text-sm">{t.phone}</TableCell>
                    <TableCell>{t.salesRep}</TableCell>
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
