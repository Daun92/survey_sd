"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface ServiceType { id: number; name: string }

interface Interview {
  id: number;
  interviewDate: string | null;
  interviewer: string | null;
  interviewType: string | null;
  satisfactionPct: number | null;
  summary: string | null;
  vocPositive: string | null;
  vocNegative: string | null;
  customer: { companyName: string; contactName: string | null };
  serviceType: { name: string };
  survey: { title: string; surveyYear: number; surveyMonth: number } | null;
}

interface Customer { id: number; companyName: string; contactName: string | null; serviceTypeId: number }

const emptyForm = {
  customerId: 0,
  serviceTypeId: 0,
  interviewDate: "",
  interviewer: "",
  interviewType: "phone",
  satisfactionPct: "",
  summary: "",
  vocPositive: "",
  vocNegative: "",
};

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchInterviews = useCallback(async () => {
    const res = await fetch("/api/interviews");
    if (res.ok) setInterviews(await res.json());
  }, []);

  useEffect(() => {
    fetchInterviews();
    fetch("/api/service-types").then((r) => r.json()).then(setServiceTypes);
  }, [fetchInterviews]);

  async function loadCustomers(serviceTypeId: number) {
    const res = await fetch(`/api/customers?serviceTypeId=${serviceTypeId}&limit=500`);
    if (res.ok) {
      const data = await res.json();
      setCustomers(data.customers);
    }
  }

  function openNew() {
    setForm(emptyForm);
    setCustomers([]);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.serviceTypeId) {
      toast.error("고객사와 서비스유형을 선택해주세요");
      return;
    }

    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        satisfactionPct: form.satisfactionPct ? parseInt(form.satisfactionPct) : null,
      }),
    });

    if (res.ok) {
      toast.success("인터뷰가 등록되었습니다");
      setDialogOpen(false);
      fetchInterviews();
    } else {
      toast.error("등록 실패");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    const res = await fetch(`/api/interviews/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("삭제되었습니다");
      fetchInterviews();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">인터뷰 관리</h1>
          <p className="text-muted-foreground">총 {interviews.length}건</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          인터뷰 등록
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>고객사</TableHead>
                <TableHead>서비스유형</TableHead>
                <TableHead>일자</TableHead>
                <TableHead>면접관</TableHead>
                <TableHead>유형</TableHead>
                <TableHead className="text-center">만족도</TableHead>
                <TableHead>요약</TableHead>
                <TableHead className="w-16">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    등록된 인터뷰가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                interviews.map((iv) => (
                  <TableRow key={iv.id}>
                    <TableCell className="font-medium">{iv.customer.companyName}</TableCell>
                    <TableCell><Badge variant="secondary">{iv.serviceType.name}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {iv.interviewDate ? new Date(iv.interviewDate).toLocaleDateString("ko-KR") : "-"}
                    </TableCell>
                    <TableCell>{iv.interviewer}</TableCell>
                    <TableCell className="text-sm">
                      {iv.interviewType === "phone" ? "전화" : iv.interviewType === "visit" ? "방문" : iv.interviewType === "online" ? "온라인" : iv.interviewType}
                    </TableCell>
                    <TableCell className="text-center">
                      {iv.satisfactionPct !== null ? (
                        <Badge variant={iv.satisfactionPct >= 80 ? "default" : "outline"}>
                          {iv.satisfactionPct}%
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{iv.summary}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(iv.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 등록 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>인터뷰 등록</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>서비스유형 *</Label>
                <Select
                  value={form.serviceTypeId ? String(form.serviceTypeId) : ""}
                  onValueChange={(v) => {
                    if (!v) return;
                    const stId = Number(v);
                    setForm({ ...form, serviceTypeId: stId, customerId: 0 });
                    loadCustomers(stId);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((st) => (
                      <SelectItem key={st.id} value={String(st.id)}>{st.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>고객사 *</Label>
                <Select
                  value={form.customerId ? String(form.customerId) : ""}
                  onValueChange={(v) => v && setForm({ ...form, customerId: Number(v) })}
                >
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>인터뷰 일자</Label>
                <Input type="date" value={form.interviewDate} onChange={(e) => setForm({ ...form, interviewDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>면접관</Label>
                <Input value={form.interviewer} onChange={(e) => setForm({ ...form, interviewer: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>인터뷰 유형</Label>
                <Select value={form.interviewType} onValueChange={(v) => v && setForm({ ...form, interviewType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">전화</SelectItem>
                    <SelectItem value="visit">방문</SelectItem>
                    <SelectItem value="online">온라인</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>만족도 (%)</Label>
                <Input type="number" min={0} max={100} value={form.satisfactionPct} onChange={(e) => setForm({ ...form, satisfactionPct: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>인터뷰 요약</Label>
              <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>긍정 VOC</Label>
              <Textarea value={form.vocPositive} onChange={(e) => setForm({ ...form, vocPositive: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>개선 VOC</Label>
              <Textarea value={form.vocNegative} onChange={(e) => setForm({ ...form, vocNegative: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
              <Button type="submit">등록</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
