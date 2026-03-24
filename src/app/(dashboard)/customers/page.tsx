"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Upload, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface ServiceType {
  id: number;
  name: string;
  nameEn: string;
}

interface Customer {
  id: number;
  companyName: string;
  contactName: string | null;
  contactTitle: string | null;
  email: string | null;
  phone: string | null;
  serviceTypeId: number;
  salesRep: string | null;
  salesTeam: string | null;
  ecoScore: number | null;
  notes: string | null;
  serviceType: ServiceType;
}

const emptyForm = {
  companyName: "",
  contactName: "",
  contactTitle: "",
  email: "",
  phone: "",
  serviceTypeId: 0,
  salesRep: "",
  salesTeam: "",
  ecoScore: "",
  notes: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filterServiceType, setFilterServiceType] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchCustomers = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (filterServiceType !== "all") params.set("serviceTypeId", filterServiceType);

    const res = await fetch(`/api/customers?${params}`);
    const data = await res.json();
    setCustomers(data.customers);
    setTotal(data.total);
  }, [page, search, filterServiceType]);

  useEffect(() => {
    fetch("/api/service-types")
      .then((r) => r.json())
      .then(setServiceTypes);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName || !form.serviceTypeId) {
      toast.error("회사명과 서비스유형은 필수입니다");
      return;
    }

    const payload = {
      ...form,
      serviceTypeId: Number(form.serviceTypeId),
      ecoScore: form.ecoScore ? Number(form.ecoScore) : null,
    };

    const url = editingId ? `/api/customers/${editingId}` : "/api/customers";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(editingId ? "고객사가 수정되었습니다" : "고객사가 등록되었습니다");
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchCustomers();
    } else {
      toast.error("오류가 발생했습니다");
    }
  }

  function openEdit(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      companyName: customer.companyName,
      contactName: customer.contactName || "",
      contactTitle: customer.contactTitle || "",
      email: customer.email || "",
      phone: customer.phone || "",
      serviceTypeId: customer.serviceTypeId,
      salesRep: customer.salesRep || "",
      salesTeam: customer.salesTeam || "",
      ecoScore: customer.ecoScore?.toString() || "",
      notes: customer.notes || "",
    });
    setDialogOpen(true);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("고객사가 삭제되었습니다");
      fetchCustomers();
    }
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/customers/import", {
      method: "POST",
      body: formData,
    });
    const result = await res.json();

    if (res.ok) {
      toast.success(`${result.success}건 임포트 완료 (실패: ${result.failed}건)`);
      fetchCustomers();
    } else {
      toast.error(result.error || "임포트 실패");
    }
    e.target.value = "";
  }

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">고객사 관리</h1>
          <p className="text-muted-foreground">
            총 {total}개 고객사
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
              onChange={handleExcelImport}
            />
          </label>
          <a
            href="/api/customers/export"
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="mr-2 h-4 w-4" />
            Excel 내보내기
          </a>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            고객사 등록
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "고객사 수정" : "고객사 등록"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>회사명 *</Label>
                    <Input
                      value={form.companyName}
                      onChange={(e) =>
                        setForm({ ...form, companyName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>서비스유형 *</Label>
                    <Select
                      value={form.serviceTypeId ? String(form.serviceTypeId) : ""}
                      onValueChange={(v) =>
                        setForm({ ...form, serviceTypeId: Number(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceTypes.map((st) => (
                          <SelectItem key={st.id} value={String(st.id)}>
                            {st.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>담당자명</Label>
                    <Input
                      value={form.contactName}
                      onChange={(e) =>
                        setForm({ ...form, contactName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>직책</Label>
                    <Input
                      value={form.contactTitle}
                      onChange={(e) =>
                        setForm({ ...form, contactTitle: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>이메일</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>전화번호</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>영업담당자</Label>
                    <Input
                      value={form.salesRep}
                      onChange={(e) =>
                        setForm({ ...form, salesRep: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>소속팀</Label>
                    <Input
                      value={form.salesTeam}
                      onChange={(e) =>
                        setForm({ ...form, salesTeam: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>에코 점수</Label>
                    <Input
                      type="number"
                      value={form.ecoScore}
                      onChange={(e) =>
                        setForm({ ...form, ecoScore: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>비고</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    취소
                  </Button>
                  <Button type="submit">
                    {editingId ? "수정" : "등록"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 필터 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="회사명, 담당자, 영업담당 검색..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={filterServiceType}
              onValueChange={(v) => {
                setFilterServiceType(v ?? "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="서비스유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {serviceTypes.map((st) => (
                  <SelectItem key={st.id} value={String(st.id)}>
                    {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>회사명</TableHead>
                <TableHead>서비스유형</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead>영업담당</TableHead>
                <TableHead>소속팀</TableHead>
                <TableHead className="w-24">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {search || filterServiceType !== "all"
                      ? "검색 결과가 없습니다"
                      : "등록된 고객사가 없습니다. Excel 임포트 또는 직접 등록해주세요."}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.companyName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.serviceType.name}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.contactName}
                      {c.contactTitle && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          {c.contactTitle}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.email}</TableCell>
                    <TableCell className="text-sm">{c.phone}</TableCell>
                    <TableCell>{c.salesRep}</TableCell>
                    <TableCell>{c.salesTeam}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(c)}
                        >
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDelete(c.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            이전
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
