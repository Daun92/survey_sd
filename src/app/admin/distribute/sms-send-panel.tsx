"use client"

import { useState, useEffect } from "react"
import { Smartphone, Send, Clock, CalendarClock, Loader2, CheckCircle2, AlertTriangle, Pencil, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { renderTemplate } from "@/lib/email/template-renderer"
import { getSmsByteLength, getSmsMessageType } from "@/lib/sms/template-renderer"
import { getSmsTemplates, scheduleSmsBatch, sendTestSms } from "./actions"

interface SmsTemplate {
  id: string
  name: string
  body_text: string
  message_type: string
  is_default: boolean
}

interface Props {
  batchId: string
  surveyId: string
  results: { name: string; email: string; uniqueToken: string; phone?: string }[]
}

type ScheduleType = "immediate" | "scheduled" | "trigger"

const SAMPLE_VARS: Record<string, string> = {
  회사명: "(주)엑셀루트",
  담당자명: "홍길동",
  과정명: "리더십 스킬 향상 과정",
  설문링크: "https://survey.exc.co.kr/d/abc123",
  교육종료일: "2026-04-15",
}

const VARIABLE_HINTS = ["{담당자명}", "{회사명}", "{과정명}", "{설문링크}", "{교육종료일}"]

export default function SmsSendPanel({ batchId, surveyId, results }: Props) {
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [scheduleType, setScheduleType] = useState<ScheduleType>("immediate")
  const [scheduledAt, setScheduledAt] = useState("")
  const [triggerDays, setTriggerDays] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [result, setResult] = useState<{ queued?: number; error?: string } | null>(null)
  const [showPanel, setShowPanel] = useState(false)

  // 편집 모드
  const [isEditing, setIsEditing] = useState(false)
  const [customBodyText, setCustomBodyText] = useState<string | null>(null)

  // 테스트 발송
  const [testPhone, setTestPhone] = useState("")
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null)

  useEffect(() => {
    async function load() {
      const data = await getSmsTemplates()
      setTemplates(data)
      const defaultTpl = data.find((t) => t.is_default)
      if (defaultTpl) setSelectedTemplateId(defaultTpl.id)
      else if (data.length > 0) setSelectedTemplateId(data[0].id)
      setLoadingTemplates(false)
    }
    load()
  }, [])

  useEffect(() => {
    setCustomBodyText(null)
    setIsEditing(false)
  }, [selectedTemplateId])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)
  const activeBodyText = customBodyText ?? selectedTemplate?.body_text ?? ""
  const renderedPreview = renderTemplate(activeBodyText, SAMPLE_VARS)
  const byteLength = getSmsByteLength(renderedPreview)
  const messageType = getSmsMessageType(renderedPreview)
  const byteLimit = messageType === "SMS" ? 90 : 2000

  // 전화번호 있는 수신자 수
  const phoneCount = results.filter((r) => r.phone).length

  async function handleSend() {
    if (!selectedTemplateId) return
    setLoading(true)
    setResult(null)

    const res = await scheduleSmsBatch({
      batchId,
      templateId: selectedTemplateId,
      scheduleType,
      scheduledAt: scheduleType === "scheduled" ? scheduledAt : undefined,
      triggerRule:
        scheduleType === "trigger"
          ? { type: "after_education_end", days: triggerDays }
          : undefined,
      customBodyText: customBodyText ?? undefined,
    })

    setResult(res)
    setLoading(false)
  }

  async function handleTestSend() {
    if (!selectedTemplateId || !testPhone) return
    setTestSending(true)
    setTestResult(null)

    const res = await sendTestSms({
      templateId: selectedTemplateId,
      testPhone,
      customBodyText: customBodyText ?? undefined,
    })

    setTestResult(res)
    setTestSending(false)
  }

  function handleResetEdits() {
    setCustomBodyText(null)
    setIsEditing(false)
  }

  if (!showPanel) {
    return (
      <Card>
        <CardContent className="py-6">
          <button
            onClick={() => setShowPanel(true)}
            className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 font-medium mx-auto"
          >
            <Smartphone size={16} />
            SMS 발송 설정
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
            {result.queued}건의 SMS가 발송 큐에 등록되었습니다
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
          <Smartphone size={18} className="text-teal-600" />
          SMS 발송
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
            SMS 템플릿 선택
          </label>
          {loadingTemplates ? (
            <div className="flex items-center gap-2 text-sm text-stone-400">
              <Loader2 size={14} className="animate-spin" />
              템플릿 로딩 중...
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-stone-400">
              등록된 SMS 템플릿이 없습니다.
            </p>
          ) : (
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.is_default ? "(기본)" : ""} [{t.message_type}]
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 미리보기 / 편집 */}
        {selectedTemplate && (
          <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-stone-400">
                {isEditing ? "템플릿 편집" : "미리보기"}
                {customBodyText !== null && !isEditing && (
                  <span className="ml-1 text-amber-500">(수정됨)</span>
                )}
              </p>
              <div className="flex gap-1">
                {customBodyText !== null && (
                  <button
                    onClick={handleResetEdits}
                    className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-600 px-1.5 py-0.5 rounded"
                    title="원본으로 초기화"
                  >
                    <RotateCcw size={10} /> 초기화
                  </button>
                )}
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                    isEditing
                      ? "text-teal-700 bg-teal-100"
                      : "text-stone-400 hover:text-stone-600"
                  }`}
                >
                  <Pencil size={10} /> {isEditing ? "편집 중" : "편집"}
                </button>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-stone-400 mb-1">본문</p>
                  <textarea
                    value={customBodyText ?? selectedTemplate.body_text}
                    onChange={(e) => setCustomBodyText(e.target.value)}
                    rows={5}
                    className="w-full rounded border border-stone-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none resize-y"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-stone-400">사용 가능 변수:</span>
                  {VARIABLE_HINTS.map((v) => (
                    <span key={v} className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded font-mono">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded border border-stone-100 p-3 whitespace-pre-wrap text-sm text-stone-700">
                {renderedPreview}
              </div>
            )}

            {/* 바이트 카운터 */}
            <div className="flex items-center justify-between mt-2">
              <span className={`text-[10px] font-mono ${
                byteLength > byteLimit
                  ? "text-red-500"
                  : byteLength > byteLimit * 0.8
                  ? "text-amber-500"
                  : "text-stone-400"
              }`}>
                {byteLength}/{byteLimit} bytes
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                messageType === "SMS"
                  ? "bg-teal-100 text-teal-700"
                  : "bg-indigo-100 text-indigo-700"
              }`}>
                {messageType}
              </span>
            </div>
          </div>
        )}

        {/* 테스트 발송 */}
        {selectedTemplate && (
          <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/50 p-3">
            <p className="text-[10px] font-medium text-stone-500 mb-2">테스트 발송</p>
            <div className="flex items-center gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="테스트 수신 전화번호"
                className="flex-1 rounded border border-stone-200 bg-white px-3 py-1.5 text-sm focus:border-teal-400 focus:outline-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestSend}
                disabled={testSending || !testPhone || !selectedTemplateId}
                className="flex-shrink-0"
              >
                {testSending ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : (
                  <Send size={12} className="mr-1" />
                )}
                테스트 발송
              </Button>
            </div>
            {testResult?.success && (
              <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 size={12} />
                테스트 SMS가 발송되었습니다 ([테스트] 접두사 포함)
              </div>
            )}
            {testResult?.error && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
                <AlertTriangle size={12} />
                {testResult.error}
              </div>
            )}
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
            전화번호 보유 수신자 <strong className="text-stone-700">{phoneCount}</strong>명
            {phoneCount < results.length && (
              <span className="text-stone-400 ml-1">/ 전체 {results.length}명</span>
            )}
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
