"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Save, Wand2 } from "lucide-react";
import type { BuilderSurvey } from "./types";

interface BuilderTopbarProps {
  survey: BuilderSurvey;
  pendingCount: number;
  previewMode: boolean;
  onTogglePreview: (v: boolean) => void;
  onAdd: () => void;
  onOpenWizard: () => void;
  onSave: () => void;
  onStatusChange: (v: string) => void;
  onBack: () => void;
  saving: boolean;
}

const STATUSES: { value: string; label: string }[] = [
  { value: "draft", label: "초안" },
  { value: "distributing", label: "배포중" },
  { value: "collecting", label: "수집중" },
  { value: "closed", label: "마감" },
  { value: "reported", label: "보고완료" },
];

export function BuilderTopbar({
  survey,
  pendingCount,
  previewMode,
  onTogglePreview,
  onAdd,
  onOpenWizard,
  onSave,
  onStatusChange,
  onBack,
  saving,
}: BuilderTopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> 목록
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold">{survey.title}</h1>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
            {survey.serviceType.name}
          </Badge>
          <span>{survey.surveyYear}.{String(survey.surveyMonth).padStart(2, "0")}</span>
        </div>
      </div>

      <Select value={survey.status} onValueChange={(v) => v && onStatusChange(v)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1">
        <Label htmlFor="preview-toggle" className="cursor-pointer text-xs">
          미리보기
        </Label>
        <Switch
          id="preview-toggle"
          checked={previewMode}
          onCheckedChange={onTogglePreview}
        />
      </div>

      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="mr-1 h-4 w-4" /> 문항 추가
      </Button>

      <Button variant="outline" size="sm" onClick={onOpenWizard}>
        <Wand2 className="mr-1 h-4 w-4" /> 마법사
      </Button>

      <Button size="sm" onClick={onSave} disabled={pendingCount === 0 || saving}>
        <Save className="mr-1 h-4 w-4" />
        {saving
          ? "저장 중..."
          : pendingCount > 0
            ? `저장 (${pendingCount})`
            : "저장"}
      </Button>
    </header>
  );
}
