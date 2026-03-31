"use client"

import { useState, useEffect } from "react"
import { Mail, Send, Clock, CalendarClock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { renderTemplate } from "@/lib/email/template-renderer"
import { getEmailTemplates, scheduleEmailBatch } from "./actions"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body_html: string
  is_default: boolean
}

interface Props {
  batchId: string
  surveyId: string
  results: { name: string; email: string; uniqueToken: string }[]
}

type ScheduleType = "immediate" | "scheduled" | "trigger"

const SAMPLE_VARS: Record<string, string> = {
  회사명: "(주)엑셀루트",
  담당자명: "홍길동",
  과정명: "리더십 스킬 향상 과정",
  설문링크: "https://example.com/d/abc123",
  교육종료일: "2026-04-15",
}

export default function EmailSendPanel({ batchId, surveyId, results }: Props) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [scheduleType, setScheduleType] = useState<ScheduleType>("immediate")
  const [scheduledAt, setScheduledAt] = useState("")
  const [triggerDays, setTriggerDays] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [result, setResult] = useState<{ queued?: number; error?: string } | null>(null)
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    async function load() {
      const data = await getEmailTemplates()
      setTemplates(data)
      const defaultTpl = data.find((t) => t.is_default)
      if (defaultTpl) setSelectedTemplateId(defaultTpl.id)
      else if (data.length > 0) setSelectedTemplateId(data[0].id)
      setLoadingTemplates(false)
    }
    load()
  }, [])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  async function handleSend() {
    if (!selectedTemplateId) return
    setLoading(true)
    setResult(null)

    const res = await scheduleEmailBatch({
      batchId,
      templateId: selectedTemplateId,
      scheduleType,
      scheduledAt: scheduleType === "scheduled" ? scheduledAt : undefined,
      triggerRule:
        scheduleType === "trigger"
          ? { type: "after_education_end", days: triggerDays }
          : undefined,
    })

    setResult(res)
    setLoading(false)
  }

  if (!showPanel) {
    return (
      <Card>
        <CardContent className="py-6">
          <button
            onClick={() => setShowPanel(true)}
            className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 font-medium mx-auto"
          >
            <Mail size={16} />
            메일 발송 설정
          </button>
        </CardContent>
      </Card>
    )
  }

  if (result?.queued) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 size={36} className="mx-auto text-emerald-600 mb-3" />
          <p className="text-sm font-medium text-stone-700">
            {result.queued}건의 메일이 발송 큐에 등록되었습니다
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {scheduleType === "immediate"
              ? "즉시 발송이 진행됩니다"
              : scheduleType === "scheduled"
              ? `${scheduledAt} 에 발송됩니다`
              : `교육종료 ${triggerDays}일 후 발송됩니다`}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail size={18} className="text-teal-600" />
          메일 발송
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {result?.error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertTriangle size={14} />
            {result.error}
          </div>
        )}

        {/* 템플릿 선택 */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            템플릿 선택
          </label>
          {loadingTemplates ? (
            <div className="flex items-center gap-2 text-sm text-stone-400">
              <Loader2 size={14} className="animate-spin" />
              템플릿 로딩 중...
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-stone-400">
              등록된 템플릿이 없습니다.{" "}
              <a href="/admin/email-templates" className="text-teal-600 hover:underline">
                템플릿 만들기
              </a>
            </p>
          ) : (
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.is_default ? "(기본)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 미리보기 */}
        {selectedTemplate && (
          <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
            <p className="text-[10px] text-stone-400 mb-1">제목 미리보기</p>
            <p className="text-sm text-stone-700 mb-3">
              {renderTemplate(selectedTemplate.subject, SAMPLE_VARS)}
            </p>
            <p className="text-[10px] text-stone-400 mb-1">본문 미리보기</p>
            <div
              className="bg-white rounded border border-stone-100 p-3 max-h-48 overflow-y-auto"
              dangerouslySetInnerHTML={{
                __html: renderTemplate(selectedTemplate.body_html, SAMPLE_VARS),
              }}
            />
          </div>
        )}

        {/* 발송 유형 */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-2">
            발송 유형
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { type: "immediate" as const, label: "즉시 발송", icon: Send },
              { type: "scheduled" as const, label: "예약 발송", icon: CalendarClock },
              { type: "trigger" as const, label: "트리거", icon: Clock },
            ].map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setScheduleType(type)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors ${
                  scheduleType === type
                    ? "border-teal-400 bg-teal-50 text-teal-700"
                    : "border-stone-200 text-stone-500 hover:border-stone-300"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 예약 옵션 */}
        {scheduleType === "scheduled" && (
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              발송 일시
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
          </div>
        )}

        {scheduleType === "trigger" && (
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              교육종료일로부터
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={30}
                value={triggerDays}
                onChange={(e) => setTriggerDays(Number(e.target.value))}
                className="w-20 rounded-lg border border-stone-200 px-3 py-2 text-sm text-center focus:border-teal-400 focus:outline-none"
              />
              <span className="text-sm text-stone-600">일 후 발송</span>
            </div>
          </div>
        )}

        {/* 요약 + 발송 */}
        <div className="flex items-center justify-between border-t border-stone-100 pt-4">
          <p className="text-xs text-stone-500">
            수신자 <strong className="text-stone-700">{results.length}</strong>명
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPanel(false)}
            >
              닫기
            </Button>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSend}
              disabled={loading || !selectedTemplateId || templates.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <Send size={14} className="mr-1.5" />
                  {scheduleType === "immediate"
                    ? "즉시 발송"
                    : scheduleType === "scheduled"
                    ? "예약 등록"
                    : "트리거 등록"}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
