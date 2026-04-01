"use client"

import { useState, useRef } from "react"
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type SmsTemplate,
} from "./actions"
import { renderTemplate } from "@/lib/email/template-renderer"
import { getSmsByteLength, getSmsMessageType } from "@/lib/sms/template-renderer"

const AVAILABLE_VARIABLES = [
  "회사명",
  "담당자명",
  "과정명",
  "설문링크",
  "교육종료일",
]

const SAMPLE_DATA: Record<string, string> = {
  회사명: "(주)엑셀루트",
  담당자명: "홍길동",
  과정명: "리더십 스킬 향상 과정",
  설문링크: "https://survey.exc.co.kr/d/abc123",
  교육종료일: "2026-04-15",
}

interface Props {
  templates: SmsTemplate[]
}

type EditorMode = "list" | "edit" | "create"

export default function SmsTemplateEditor({ templates: initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [mode, setMode] = useState<EditorMode>("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // 편집 폼 상태
  const [name, setName] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function openCreate() {
    setSelectedId(null)
    setName("")
    setBodyText("")
    setIsDefault(false)
    setError("")
    setMode("create")
  }

  function openEdit(template: SmsTemplate) {
    setSelectedId(template.id)
    setName(template.name)
    setBodyText(template.body_text)
    setIsDefault(template.is_default)
    setError("")
    setMode("edit")
  }

  function insertVariable(varName: string) {
    const tag = `{${varName}}`
    const el = bodyRef.current
    if (el) {
      const start = el.selectionStart ?? bodyText.length
      const end = el.selectionEnd ?? bodyText.length
      const newVal = bodyText.slice(0, start) + tag + bodyText.slice(end)
      setBodyText(newVal)
      setTimeout(() => {
        el.focus()
        el.setSelectionRange(start + tag.length, start + tag.length)
      }, 0)
    }
  }

  // 바이트 & 메시지 타입 계산
  const previewText = renderTemplate(bodyText, SAMPLE_DATA)
  const byteLength = getSmsByteLength(previewText)
  const messageType = getSmsMessageType(previewText)
  const byteLimit = messageType === "SMS" ? 90 : 2000

  async function handleSave() {
    if (!name.trim() || !bodyText.trim()) {
      setError("이름과 본문을 모두 입력해 주세요")
      return
    }
    setSaving(true)
    setError("")

    const input = {
      name: name.trim(),
      body_text: bodyText,
      message_type: getSmsMessageType(bodyText),
      variables: AVAILABLE_VARIABLES,
      is_default: isDefault,
    }

    let result: { id?: string; error?: string }
    if (mode === "create") {
      result = await createTemplate(input)
    } else {
      result = await updateTemplate(selectedId!, input)
    }

    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    if (mode === "create" && result.id) {
      const newTemplate: SmsTemplate = {
        id: result.id,
        ...input,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setTemplates((prev) => {
        const updated = isDefault
          ? prev.map((t) => ({ ...t, is_default: false }))
          : prev
        return [newTemplate, ...updated]
      })
    } else if (mode === "edit") {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? {
                ...t,
                ...input,
                updated_at: new Date().toISOString(),
              }
            : isDefault
            ? { ...t, is_default: false }
            : t
        )
      )
    }

    setSaving(false)
    setMode("list")
  }

  async function handleDelete(id: string) {
    if (!confirm("이 템플릿을 삭제하시겠습니까?")) return
    const result = await deleteTemplate(id)
    if (result.error) {
      alert(result.error)
      return
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    if (selectedId === id) setMode("list")
  }

  // ─── 목록 뷰 ───
  if (mode === "list") {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={openCreate}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
          >
            + 새 SMS 템플릿
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
            <p className="text-sm text-stone-400">등록된 SMS 템플릿이 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-stone-200 bg-white p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-stone-800 text-sm">
                      {t.name}
                    </h3>
                    {t.is_default && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                        기본
                      </span>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    t.message_type === "SMS"
                      ? "bg-teal-50 text-teal-700"
                      : "bg-indigo-50 text-indigo-700"
                  }`}>
                    {t.message_type}
                  </span>
                </div>
                <p className="text-xs text-stone-500 line-clamp-3 whitespace-pre-wrap">
                  {t.body_text}
                </p>
                <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
                  <button
                    onClick={() => openEdit(t)}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                  >
                    편집
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-xs text-stone-400 hover:text-red-500"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── 편집/생성 뷰 ───
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMode("list")}
          className="text-sm text-stone-500 hover:text-stone-800"
        >
          ← 목록으로
        </button>
        <h2 className="text-sm font-semibold text-stone-700">
          {mode === "create" ? "새 SMS 템플릿" : "SMS 템플릿 편집"}
        </h2>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 좌측: 편집 */}
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              템플릿 이름
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: CS 설문 안내 (기본)"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              본문
            </label>
            <textarea
              ref={bodyRef}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={10}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none leading-relaxed"
              placeholder="문자 메시지 본문을 입력하세요..."
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>

            {/* 바이트 카운터 */}
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-[11px] font-mono ${
                byteLength > byteLimit
                  ? "text-red-500"
                  : byteLength > byteLimit * 0.8
                  ? "text-amber-500"
                  : "text-stone-400"
              }`}>
                {byteLength} / {byteLimit} bytes
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                messageType === "SMS"
                  ? "bg-teal-50 text-teal-700"
                  : "bg-indigo-50 text-indigo-700"
              }`}>
                {messageType} (자동 판별)
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
            />
            기본 템플릿
          </label>

          <div className="flex gap-3 pt-3 border-t border-stone-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={() => setMode("list")}
              className="rounded-lg border border-stone-200 px-5 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>

        {/* 우측: 미리보기 */}
        <div className="space-y-3">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
              미리보기
            </h3>
            <div className="rounded-lg border border-stone-100 bg-stone-50 p-4">
              {bodyText ? (
                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                  {previewText}
                </p>
              ) : (
                <p className="text-sm text-stone-300 text-center py-8">
                  본문을 입력하면 미리보기가 표시됩니다
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
              샘플 데이터
            </h3>
            <div className="space-y-1">
              {Object.entries(SAMPLE_DATA).map(([k, v]) => (
                <div key={k} className="flex text-xs">
                  <span className="w-20 text-stone-400 shrink-0">{`{${k}}`}</span>
                  <span className="text-stone-600">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs text-amber-700">
              SMS: 90바이트(한글 약 45자) 이하 / LMS: 90바이트 초과 ~ 2,000바이트.
              메시지 타입은 본문 길이에 따라 자동 판별됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
