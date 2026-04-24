'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles, X, Loader2, Plus, FileText, Check, Upload, Paperclip,
  Wand2, Send,
} from 'lucide-react'
import { addQuestion, bulkAddQuestions } from './actions'

interface GeneratedQuestion {
  section: string
  sectionLabel: string
  code: string
  text: string
  type: 'likert5' | 'text'
  required: boolean
}

interface Template {
  id: string
  name: string
  description?: string
  question_config?: { section?: string; question_code?: string; question_text: string; question_type?: string; is_required?: boolean }[]
}

interface AttachedFile {
  name: string
  base64: string
  mimeType: string
  size: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  files?: { name: string }[]
  questions?: GeneratedQuestion[]
}

interface AIFabProps {
  surveyId: string
  educationType: string
  templates: Template[]
  onQuestionsAdded: () => void
}

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'IMG', 'image/jpeg': 'IMG', 'image/gif': 'IMG', 'image/webp': 'IMG',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLS',
  'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
}

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.xlsx', '.xls', '.csv', '.pptx', '.txt', '.md']

function getFileLabel(mimeType: string, name: string): string {
  if (ALLOWED_TYPES[mimeType]) return ALLOWED_TYPES[mimeType]
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pptx') return 'PPTX'
  if (ext === 'md') return 'MD'
  if (ext === 'txt') return 'TXT'
  return 'FILE'
}

export default function AIFab({ surveyId, educationType, templates, onQuestionsAdded }: AIFabProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'ai' | 'template'>('ai')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 설문 문항 설계 도우미입니다.\n\n일정표, 강의계획서, 기획서, 운영안 등을 첨부하시면 내용을 분석하여 최적의 설문 문항을 구성해 드립니다.\n\nPDF, PPTX, 이미지, Excel, CSV, TXT, MD 파일을 지원합니다.' }
  ])
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [addingTemplate, setAddingTemplate] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (!selected) return

    for (const file of Array.from(selected)) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_TYPES[file.type] && !ALLOWED_EXTENSIONS.includes(ext)) continue
      if (file.size > 15 * 1024 * 1024) continue

      const base64 = await fileToBase64(file)
      setFiles((prev) => [...prev, { name: file.name, base64, mimeType: file.type || 'application/octet-stream', size: file.size }])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const sendMessage = async () => {
    if (!prompt.trim() && files.length === 0) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: prompt || (files.length > 0 ? `${files.map((f) => f.name).join(', ')} 파일을 기반으로 설문 문항을 설계해 주세요.` : ''),
      files: files.map((f) => ({ name: f.name })),
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    const apiFiles = files.map((f) => ({ base64: f.base64, mimeType: f.mimeType, fileName: f.name }))
    const userPrompt = prompt || '첨부된 파일 내용을 분석하여 교육 만족도 설문 문항을 설계해 주세요.'

    setPrompt('')
    setFiles([])

    try {
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ educationType, additionalPrompt: userPrompt, files: apiFiles }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `오류: ${data.error}` }])
      } else {
        const questions: GeneratedQuestion[] = data.questions || []
        const summary = questions.length > 0
          ? `${questions.length}개 문항을 생성했습니다.\n\n섹션별 구성:\n${[...new Set(questions.map((q) => q.sectionLabel || q.section))].map((s) => `• ${s}`).join('\n')}\n\n아래에서 개별 또는 전체 추가할 수 있습니다.`
          : '문항 생성에 실패했습니다. 다른 요청을 시도해 주세요.'
        setMessages((prev) => [...prev, { role: 'assistant', content: summary, questions }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }])
    } finally {
      setLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const addSingleQuestion = async (q: GeneratedQuestion, msgIdx: number, qIdx: number) => {
    const key = `${msgIdx}-${qIdx}`
    try {
      await addQuestion(surveyId, {
        section: q.sectionLabel || q.section || '추가 문항',
        question_text: q.text,
        question_type: q.type === 'text' ? 'text' : 'likert_5',
        is_required: q.required,
      })
      setAddedIds((prev) => new Set(prev).add(key))
      onQuestionsAdded()
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : '문항 추가 실패' },
      ])
    }
  }

  const addAllFromMessage = async (questions: GeneratedQuestion[], msgIdx: number) => {
    setLoading(true)
    try {
      const pending = questions
        .map((q, i) => ({ q, i, key: `${msgIdx}-${i}` }))
        .filter(({ key }) => !addedIds.has(key))

      if (pending.length === 0) return

      await bulkAddQuestions(
        surveyId,
        pending.map(({ q }) => ({
          section: q.sectionLabel || q.section || '추가 문항',
          question_text: q.text,
          question_type: q.type === 'text' ? 'text' : 'likert_5',
          is_required: q.required,
        })),
      )
      setAddedIds((prev) => {
        const next = new Set(prev)
        for (const { key } of pending) next.add(key)
        return next
      })
      onQuestionsAdded()
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : '문항 추가 실패' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const applyTemplate = async (template: Template) => {
    if (!template.question_config?.length) return
    setAddingTemplate(true)
    try {
      await bulkAddQuestions(
        surveyId,
        template.question_config.map((q) => ({
          section: q.section || '템플릿 문항',
          question_text: q.question_text,
          question_type: q.question_type || 'likert_5',
          is_required: q.is_required ?? true,
        })),
      )
      onQuestionsAdded()
      setSelectedTemplateId(null)
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : '템플릿 추가 실패' },
      ])
    } finally {
      setAddingTemplate(false)
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 h-12 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        <Wand2 size={18} />
        <span className="text-sm font-semibold">설문 마법사</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[620px] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 size={16} className="text-teal-600" />
          <span className="text-sm font-semibold text-stone-800">설문 설계 마법사</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-600"><X size={16} /></button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-100 shrink-0">
        <button
          onClick={() => setTab('ai')}
          className={`flex-1 py-2.5 text-xs font-medium ${tab === 'ai' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-stone-400'}`}
        >
          <Sparkles size={12} className="inline mr-1" />AI 마법사
        </button>
        <button
          onClick={() => setTab('template')}
          className={`flex-1 py-2.5 text-xs font-medium ${tab === 'template' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-stone-400'}`}
        >
          <FileText size={12} className="inline mr-1" />템플릿
        </button>
      </div>

      {/* AI Chat Tab */}
      {tab === 'ai' && (
        <>
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, mIdx) => (
              <div key={mIdx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-2xl rounded-br-md px-3 py-2' : 'bg-stone-100 text-stone-700 rounded-2xl rounded-bl-md px-3 py-2'}`}>
                  {/* File badges */}
                  {msg.files && msg.files.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {msg.files.map((f, i) => (
                        <span key={i} className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${msg.role === 'user' ? 'bg-teal-500/50' : 'bg-stone-200'}`}>
                          <Paperclip size={9} />{f.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs leading-relaxed whitespace-pre-line">{msg.content}</p>
                  {/* Generated questions */}
                  {msg.questions && msg.questions.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium opacity-70">{msg.questions.length}개 문항</span>
                        <button
                          onClick={() => addAllFromMessage(msg.questions!, mIdx)}
                          disabled={loading}
                          className="text-[10px] font-medium bg-teal-600 text-white px-2 py-0.5 rounded-md hover:bg-teal-700"
                        >
                          전체 추가
                        </button>
                      </div>
                      {msg.questions.map((q, qIdx) => {
                        const key = `${mIdx}-${qIdx}`
                        return (
                          <div key={qIdx} className="flex items-start gap-1.5 p-1.5 rounded-lg bg-white/80 border border-stone-200/50">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-stone-700 leading-relaxed">{q.text}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{q.type === 'text' ? '서술' : '5점'}</Badge>
                                <span className="text-[8px] text-stone-400">{q.sectionLabel || q.section}</span>
                              </div>
                            </div>
                            {addedIds.has(key) ? (
                              <Check size={12} className="text-teal-600 shrink-0 mt-0.5" />
                            ) : (
                              <button onClick={() => addSingleQuestion(q, mIdx, qIdx)} className="shrink-0 p-0.5 text-stone-400 hover:text-teal-600">
                                <Plus size={12} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-stone-100 rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-teal-600" />
                  <span className="text-xs text-stone-500">분석 중...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* File attachments */}
          {files.length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-teal-50 text-teal-700 px-2 py-1 rounded-md border border-teal-200">
                  <span className="font-medium">{getFileLabel(f.mimeType, f.name)}</span>
                  <span className="max-w-[100px] truncate">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-teal-400 hover:text-teal-700"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="px-4 pb-4 pt-2 border-t border-stone-100 shrink-0">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 p-2 text-stone-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                title="파일 첨부 (PDF, PPTX, 이미지, Excel, TXT, MD)"
              >
                <Paperclip size={18} />
              </button>
              <Textarea
                placeholder="요청사항을 입력하세요..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={1}
                className="text-sm min-h-[36px] max-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || (!prompt.trim() && files.length === 0)}
                className="shrink-0 p-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-lg transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[9px] text-stone-400 mt-1.5 pl-10">PDF, PPTX, 이미지, Excel, CSV, TXT, MD 지원 (최대 15MB)</p>
          </div>
        </>
      )}

      {/* Template Tab */}
      {tab === 'template' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {templates.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">사용 가능한 템플릿이 없습니다</p>
            ) : selectedTemplateId && selectedTemplate ? (
              <div className="space-y-3">
                <button onClick={() => setSelectedTemplateId(null)} className="text-xs text-stone-500 hover:text-stone-700">← 목록으로</button>
                <div>
                  <p className="text-sm font-medium text-stone-800">{selectedTemplate.name}</p>
                  {selectedTemplate.description && <p className="text-xs text-stone-500 mt-0.5">{selectedTemplate.description}</p>}
                </div>
                {selectedTemplate.question_config && (
                  <>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {selectedTemplate.question_config.map((q, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs p-1.5 rounded bg-stone-50">
                          <span className="text-stone-400 font-mono w-6 shrink-0">{q.question_code || `Q${i + 1}`}</span>
                          <span className="text-stone-600 flex-1">{q.question_text}</span>
                        </div>
                      ))}
                    </div>
                    <Button onClick={() => applyTemplate(selectedTemplate)} disabled={addingTemplate} className="w-full h-9 text-xs">
                      {addingTemplate ? <><Loader2 size={14} className="animate-spin mr-1" />추가 중...</> : <><Plus size={14} className="mr-1" />{selectedTemplate.question_config.length}개 문항 추가</>}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className="w-full text-left p-3 rounded-lg border border-stone-200 hover:border-teal-300 hover:bg-teal-50/50 transition-all"
                >
                  <div className="flex items-start gap-2">
                    <FileText size={14} className="text-stone-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-stone-800">{t.name}</p>
                      {t.description && <p className="text-xs text-stone-500 mt-0.5">{t.description}</p>}
                      {t.question_config && <span className="text-[10px] text-teal-600 mt-1 block">{t.question_config.length}개 문항</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
