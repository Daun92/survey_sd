"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { isLockedStatus, type BuilderSurvey } from "./types";

interface BuilderMetaBarProps {
  survey: BuilderSurvey;
  onUpdate: (field: string, value: string | boolean) => void | Promise<void>;
}

export function BuilderMetaBar({ survey, onUpdate }: BuilderMetaBarProps) {
  const locked = isLockedStatus(survey.status);

  return (
    <div className="space-y-3">
      {locked && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            이 설문은 <b>{survey.status}</b> 상태입니다. 변경 사항은 즉시 응답자에게 반영될 수
            있습니다.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/30 p-3 md:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1">
          <Label htmlFor="meta-title" className="text-[11px] uppercase tracking-wider text-muted-foreground">
            설문 제목
          </Label>
          <Input
            id="meta-title"
            defaultValue={survey.title}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== survey.title) onUpdate("title", next);
            }}
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="meta-label" className="text-[11px] uppercase tracking-wider text-muted-foreground">
            내부 태그
          </Label>
          <Input
            id="meta-label"
            defaultValue={survey.internalLabel ?? ""}
            placeholder="예: A사 리더십 1기"
            onBlur={(e) => {
              const next = e.target.value;
              if (next !== (survey.internalLabel ?? "")) onUpdate("internalLabel", next);
            }}
            className="h-9 w-[200px]"
          />
        </div>

        <div className="flex items-end gap-4">
          <div className="flex flex-col items-start gap-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              서비스
            </Label>
            <Badge variant="secondary" className="h-7 px-2.5">
              {survey.serviceType.name}
            </Badge>
          </div>
          <div className="flex flex-col items-start gap-1">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              회차
            </Label>
            <div className="flex h-7 items-center text-sm text-foreground">
              {survey.surveyYear}.{String(survey.surveyMonth).padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
        <div className="space-y-0.5">
          <Label className="text-xs">응답자에게 프로젝트명 표시</Label>
          <p className="text-[11px] text-muted-foreground">
            이메일 및 설문 시작 화면에 교육과정/프로젝트명을 노출합니다
          </p>
        </div>
        <Switch
          checked={survey.showProjectName}
          onCheckedChange={(checked) => onUpdate("showProjectName", checked)}
        />
      </div>
    </div>
  );
}
