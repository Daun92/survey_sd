"use client"

import { useState, useRef } from "react"
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type EmailTemplate,
} from "./actions"
import { renderTemplate } from "@/lib/email/template-renderer"

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
  설문링크: "https://example.com/d/abc123",
  교육종료일: "2026-04-15",
}

const EDUCATION_TYPES = [
  { value: "", label: "전체 (기본)" },
  { value: "cs", label: "CS 교육" },
  { value: "leadership", label: "리더십" },
  { value: "management", label: "경영/관리" },
  { value: "sales", label: "영업/마케팅" },
]

interface Props {
  templates: EmailTemplate[]
}

type EditorMode = "list" | "edit" | "create"

export default function TemplateEditor({ templates: initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [mode, setMode] = useState<EditorMode>("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // 편집 폼 상태
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [educationType, setEducationType] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)

  function openCreate() {
    setSelectedId(null)
    setName("")
    setSubject("")
    setBodyHtml("")
    setEducationType("")
    setIsDefault(false)
    setError("")
    setMode("create")
  }

  function openEdit(template: EmailTemplate) {
    setSelectedId(template.id)
    setName(template.name)
    setSubject(template.subject)
    setBodyHtml(template.body_html)
    setEducationType(template.education_type ?? "")
    setIsDefault(template.is_default)
    setError("")
    setMode("edit")
  }

  function insertVariable(varName: string, target: "subject" | "body") {
    const tag = `{${varName}}`
    if (target === "subject") {
      const el = subjectRef.current
      if (el) {
        const start = el.selectionStart ?? subject.length
        const end = el.selectionEnd ?? subject.length
        const newVal = subject.slice(0, start) + tag + subject.slice(end)
        setSubject(newVal)
        setTimeout(() => {
          el.focus()
          el.setSelectionRange(start + tag.length, start + tag.length)
        }, 0)
      }
    } else {
      const el = bodyRef.current
      if (el) {
        const start = el.selectionStart ?? bodyHtml.length
        const end = el.selectionEnd ?? bodyHtml.length
        const newVal = bodyHtml.slice(0, start) + tag + bodyHtml.slice(end)
        setBodyHtml(newVal)
        setTimeout(() => {
          el.focus()
          el.setSelectionRange(start + tag.length, start + tag.length)
        }, 0)
      }
    }
  }

  async function handleSave() {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      setError("이름, 제목, 본문을 모두 입력해 주세요")
      return
    }
    setSaving(true)
    setError("")

    const input = {
      name: name.trim(),
      subject: subject.trim(),
      body_html: bodyHtml,
      variables: AVAILABLE_VARIABLES,
      education_type: educationType || null,
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

    // 목록 갱신 (간단히 전체 페이지 리로드 대신 로컬 업데이트)
    if (mode === "create" && result.id) {
      const newTemplate: EmailTemplate = {
        id: result.id,
        ...input,
        education_type: input.education_type,
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
                education_type: input.education_type,
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
            + 새 템플릿
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
            <p className="text-sm text-stone-400">등록된 템플릿이 없습니다</p>
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
                </div>
                <p className="text-xs text-stone-500 mb-1 truncate">
                  제목: {t.subject}
                </p>
                {t.education_type && (
                  <span className="inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 mb-3">
                    {EDUCATION_TYPES.find((e) => e.value === t.education_type)
                      ?.label ?? t.education_type}
                  </span>
                )}
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
  const previewHtml = renderTemplate(bodyHtml, SAMPLE_DATA)
  const previewSubject = renderTemplate(subject, SAMPLE_DATA)

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
          {mode === "create" ? "새 템플릿" : "템플릿 편집"}
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
              메일 제목
            </label>
            <input
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: [{회사명}] {과정명} 설문 안내"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={`subj-${v}`}
                  type="button"
                  onClick={() => insertVariable(v, "subject")}
                  className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              본문 (HTML)
            </label>
            <textarea
              ref={bodyRef}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={16}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs font-mono focus:border-teal-400 focus:outline-none leading-relaxed"
              placeholder="<div>메일 본문 HTML을 입력하세요...</div>"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={`body-${v}`}
                  type="button"
                  onClick={() => insertVariable(v, "body")}
                  className="rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                교육유형
              </label>
              <select
                value={educationType}
                onChange={(e) => setEducationType(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
              >
                {EDUCATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                />
                기본 템플릿
              </label>
            </div>
          </div>

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
            <div className="mb-3 rounded-lg bg-stone-50 px-3 py-2">
              <p className="text-[10px] text-stone-400 mb-0.5">제목</p>
              <p className="text-sm font-medium text-stone-700">
                {previewSubject || "(제목 없음)"}
              </p>
            </div>
            <div className="rounded-lg border border-stone-100 bg-white p-4">
              {bodyHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  className="prose prose-sm max-w-none"
                />
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
        </div>
      </div>
    </div>
  )
}
