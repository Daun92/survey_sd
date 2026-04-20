"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, FileText, FolderOpen, Tag } from "lucide-react";
import { DeprecatedPageBanner } from "@/components/layout/deprecated-banner";

interface ServiceType { id: number; name: string }
interface Template { id: number; templateName: string; serviceTypeId: number; serviceType: ServiceType }
interface Survey {
  id: number;
  title: string;
  surveyYear: number;
  surveyMonth: number;
  status: string;
  internalLabel: string | null;
  serviceType: ServiceType;
  projectNames: string[];
  _count: { questions: number; distributions: number; responses: number };
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "초안", variant: "outline" },
  distributing: { label: "배포중", variant: "secondary" },
  collecting: { label: "수집중", variant: "secondary" },
  closed: { label: "마감", variant: "default" },
  reported: { label: "보고완료", variant: "default" },
};

export default function SurveysPage() {
  const now = new Date();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    internalLabel: "",
    serviceTypeId: 0,
    surveyYear: now.getFullYear(),
    surveyMonth: now.getMonth() + 1,
    templateId: 0,
  });

  const fetchSurveys = useCallback(async () => {
    const res = await fetch("/api/surveys");
    setSurveys(await res.json());
  }, []);

  useEffect(() => {
    fetchSurveys();
    fetch("/api/service-types").then((r) => r.json()).then(setServiceTypes);
    fetch("/api/surveys/templates").then((r) => r.json()).then(setTemplates);
  }, [fetchSurveys]);

  function openNew() {
    setForm({
      title: `${now.getFullYear()}년 ${now.getMonth() + 1}월 만족도 설문`,
      internalLabel: "",
      serviceTypeId: 0,
      surveyYear: now.getFullYear(),
      surveyMonth: now.getMonth() + 1,
      templateId: 0,
    });
    setDialogOpen(true);
  }

  // 서비스유형 변경 시 자동으로 제목과 템플릿 설정
  function onServiceTypeChange(stId: number) {
    const st = serviceTypes.find((s) => s.id === stId);
    const tmpl = templates.find((t) => t.serviceTypeId === stId);
    setForm({
      ...form,
      serviceTypeId: stId,
      title: `${form.surveyYear}년 ${form.surveyMonth}월 ${st?.name || ""} 만족도 설문`,
      templateId: tmpl?.id || 0,
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.serviceTypeId) {
      toast.error("서비스유형을 선택해주세요");
      return;
    }

    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        internalLabel: form.internalLabel || undefined,
        serviceTypeId: form.serviceTypeId,
        surveyYear: form.surveyYear,
        surveyMonth: form.surveyMonth,
        trainingMonth: form.surveyMonth === 1 ? 12 : form.surveyMonth - 1,
        templateId: form.templateId || undefined,
      }),
    });

    if (res.ok) {
      toast.success("설문이 생성되었습니다");
      setDialogOpen(false);
      fetchSurveys();
    } else {
      const err = await res.json();
      toast.error(err.error || "설문 생성 실패");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("이 설문을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/surveys/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("설문이 삭제되었습니다");
      fetchSurveys();
    }
  }

  return (
    <div className="space-y-6">
      <DeprecatedPageBanner
        targetPath="/admin/surveys"
        targetLabel="교육 설문 관리자"
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">설문 관리</h1>
          <p className="text-muted-foreground">총 {surveys.length}개 설문</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          새 설문 만들기
        </Button>
      </div>

      {/* 설문 카드 목록 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {surveys.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>생성된 설문이 없습니다</p>
              <p className="text-sm">새 설문 만들기를 클릭하여 시작하세요</p>
            </CardContent>
          </Card>
        ) : (
          surveys.map((s) => {
            const st = statusLabels[s.status] || statusLabels.draft;
            return (
              <Card key={s.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base leading-tight">{s.title}</CardTitle>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{s.serviceType.name}</Badge>
                    <span>{s.surveyYear}년 {s.surveyMonth}월</span>
                  </div>
                  {s.internalLabel && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" />
                      <span>{s.internalLabel}</span>
                    </div>
                  )}
                  {s.projectNames.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FolderOpen className="h-3 w-3" />
                      <span>
                        {s.projectNames[0]}
                        {s.projectNames.length > 1 && ` 외 ${s.projectNames.length - 1}건`}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="font-semibold text-lg">{s._count.questions}</div>
                      <div className="text-muted-foreground">문항</div>
                    </div>
                    <div>
                      <div className="font-semibold text-lg">{s._count.distributions}</div>
                      <div className="text-muted-foreground">배포</div>
                    </div>
                    <div>
                      <div className="font-semibold text-lg">{s._count.responses}</div>
                      <div className="text-muted-foreground">응답</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/surveys/${s.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1" })}
                    >
                      편집
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(s.id)}
                    >
                      삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 생성 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 설문 만들기</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>년도</Label>
                <Select
                  value={String(form.surveyYear)}
                  onValueChange={(v) => v && setForm({ ...form, surveyYear: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>월</Label>
                <Select
                  value={String(form.surveyMonth)}
                  onValueChange={(v) => v && setForm({ ...form, surveyMonth: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>서비스유형 *</Label>
              <Select
                value={form.serviceTypeId ? String(form.serviceTypeId) : ""}
                onValueChange={(v) => v && onServiceTypeChange(Number(v))}
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
              <Label>설문 제목</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>내부 구분 태그 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Input
                value={form.internalLabel}
                onChange={(e) => setForm({ ...form, internalLabel: e.target.value })}
                placeholder="예: A사 리더십 1기, B사 신입교육 3월반"
              />
            </div>
            <div className="space-y-2">
              <Label>문항 템플릿</Label>
              <Select
                value={form.templateId ? String(form.templateId) : "none"}
                onValueChange={(v) => setForm({ ...form, templateId: v === "none" ? 0 : Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">템플릿 없이 시작</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.templateName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                취소
              </Button>
              <Button type="submit">생성</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
