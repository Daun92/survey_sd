"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Send, Copy, RefreshCw, Mail, CheckCircle2, Clock, Eye,
} from "lucide-react";

interface Distribution {
  id: number;
  surveyId: number;
  customerId: number;
  channel: string;
  sentAt: string | null;
  responseToken: string;
  status: string;
  reminderCount: number;
  createdAt: string;
  customer: {
    companyName: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    serviceType: { name: string };
  };
  responses: Array<{ id: number; respondedAt: string | null; isComplete: boolean }>;
}

interface Target {
  customerId: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  serviceType: string;
  serviceTypeId: number;
}

interface Summary {
  total: number;
  sent: number;
  responded: number;
  responseRate: number;
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pending: { label: "대기", icon: Clock, className: "text-muted-foreground" },
  sent: { label: "발송", icon: Send, className: "text-blue-500" },
  delivered: { label: "전달", icon: Mail, className: "text-blue-500" },
  opened: { label: "열람", icon: Eye, className: "text-yellow-500" },
  responded: { label: "응답완료", icon: CheckCircle2, className: "text-green-500" },
  bounced: { label: "실패", icon: RefreshCw, className: "text-red-500" },
};

export default function DistributeSurveyPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params);
  const router = useRouter();
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, sent: 0, responded: 0, responseRate: 0 });
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [survey, setSurvey] = useState<{ title: string; surveyYear: number; surveyMonth: number } | null>(null);

  const fetchDistributions = useCallback(async () => {
    const res = await fetch(`/api/distributions?surveyId=${surveyId}`);
    const data = await res.json();
    setDistributions(data.distributions);
    setSummary(data.summary);
  }, [surveyId]);

  useEffect(() => {
    fetchDistributions();
    fetch(`/api/surveys/${surveyId}`).then((r) => r.json()).then(setSurvey);
  }, [fetchDistributions, surveyId]);

  async function loadTargets() {
    if (!survey) return;
    // 교육 실시 대상자 로드
    const trainingMonth = survey.surveyMonth === 1 ? 12 : survey.surveyMonth - 1;
    const trainingYear = survey.surveyMonth === 1 ? survey.surveyYear - 1 : survey.surveyYear;
    const res = await fetch(`/api/training/target-list?year=${trainingYear}&month=${trainingMonth}`);
    const data = await res.json();

    // 이미 배포된 고객사 제외
    const existingCustomerIds = new Set(distributions.map((d) => d.customerId));
    const available = (data.targets as Target[]).filter((t) => !existingCustomerIds.has(t.customerId));
    setTargets(available);
    setSelectedIds(new Set(available.map((t) => t.customerId)));
    setAddDialogOpen(true);
  }

  async function createDistributions() {
    if (selectedIds.size === 0) {
      toast.error("대상 고객사를 선택해주세요");
      return;
    }

    const res = await fetch("/api/distributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        surveyId: parseInt(surveyId),
        customerIds: Array.from(selectedIds),
        channel: "email",
      }),
    });

    const result = await res.json();
    if (res.ok) {
      toast.success(`${result.created}건 배포 생성 완료`);
      setAddDialogOpen(false);
      fetchDistributions();
    } else {
      toast.error(result.error || "배포 생성 실패");
    }
  }

  async function sendEmails() {
    const pendingIds = distributions.filter((d) => d.status === "pending").map((d) => d.id);
    if (pendingIds.length === 0) {
      toast.error("발송 대기 중인 배포가 없습니다");
      return;
    }

    const res = await fetch("/api/distributions/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distributionIds: pendingIds }),
    });

    const result = await res.json();
    if (res.ok) {
      toast.success(`${result.sent}건 발송 완료 (실패: ${result.failed}건)`);
      fetchDistributions();
    } else {
      toast.error(result.error || "발송 실패");
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/respond/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("링크가 복사되었습니다");
  }

  const filtered = statusFilter === "all"
    ? distributions
    : distributions.filter((d) => d.status === statusFilter);

  const pendingCount = distributions.filter((d) => d.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/distribute")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> 목록
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{survey?.title || "설문 배포"}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadTargets}>
            <Plus className="mr-2 h-4 w-4" />
            대상자 추가
          </Button>
          {pendingCount > 0 && (
            <Button size="sm" onClick={sendEmails}>
              <Send className="mr-2 h-4 w-4" />
              이메일 발송 ({pendingCount}건)
            </Button>
          )}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 배포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">발송 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{summary.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">응답 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{summary.responded}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">응답률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.responseRate}%</div>
            <div className="mt-1 h-2 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${summary.responseRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 + 배포 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">배포 목록</CardTitle>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="pending">대기</SelectItem>
              <SelectItem value="sent">발송</SelectItem>
              <SelectItem value="opened">열람</SelectItem>
              <SelectItem value="responded">응답완료</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>고객사</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>발송일</TableHead>
                <TableHead className="w-28">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {distributions.length === 0
                      ? "배포 대상이 없습니다. '대상자 추가'를 클릭하세요."
                      : "해당 상태의 배포가 없습니다."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d) => {
                  const sc = statusConfig[d.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.customer.companyName}</TableCell>
                      <TableCell>{d.customer.contactName}</TableCell>
                      <TableCell className="text-sm">{d.customer.email || "-"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-sm ${sc.className}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.sentAt ? new Date(d.sentAt).toLocaleDateString("ko-KR") : "-"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => copyLink(d.responseToken)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 대상자 추가 다이얼로그 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>배포 대상 고객사 선택</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>교육 실시 대상자 중 미배포 고객사: {targets.length}건</span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setSelectedIds(new Set(targets.map((t) => t.customerId)))}
                >
                  전체 선택
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  선택 해제
                </Button>
              </div>
            </div>
            {targets.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                추가할 대상 고객사가 없습니다 (모두 배포 완료 또는 교육 실시 대상 없음)
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === targets.length && targets.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(new Set(targets.map((t) => t.customerId)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>회사명</TableHead>
                      <TableHead>서비스유형</TableHead>
                      <TableHead>담당자</TableHead>
                      <TableHead>이메일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((t) => (
                      <TableRow key={t.customerId}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(t.customerId)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(t.customerId);
                              else next.delete(t.customerId);
                              setSelectedIds(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{t.companyName}</TableCell>
                        <TableCell><Badge variant="secondary">{t.serviceType}</Badge></TableCell>
                        <TableCell>{t.contactName}</TableCell>
                        <TableCell className="text-sm">{t.email || <span className="text-muted-foreground">없음</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>취소</Button>
              <Button onClick={createDistributions} disabled={selectedIds.size === 0}>
                {selectedIds.size}건 배포 생성
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
