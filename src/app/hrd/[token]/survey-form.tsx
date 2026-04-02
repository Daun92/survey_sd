'use client'

import { useState, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import type { HrdSurveyRound, HrdSurveyPart, HrdSurveyItem, HrdRespondent, AnswerOption } from '@/types/hrd-survey'
import { HRD_PART_NAMES } from '@/types/hrd-survey'

interface Props {
  respondent: HrdRespondent
  round: HrdSurveyRound
  parts: (HrdSurveyPart & { items: HrdSurveyItem[] })[]
  existingResponses: Record<string, { text?: string; number?: number; json?: unknown }>
  token: string
}

export function HrdSurveyForm({ respondent, round, parts, existingResponses, token }: Props) {
  const [currentPartIndex, setCurrentPartIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | number | unknown>>(
    () => {
      const initial: Record<string, string | number | unknown> = {}
      Object.entries(existingResponses).forEach(([itemId, val]) => {
        if (val.text) initial[itemId] = val.text
        else if (val.number !== undefined) initial[itemId] = val.number
        else if (val.json) initial[itemId] = val.json
      })
      return initial
    }
  )
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(respondent.status === 'completed')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentPart = parts[currentPartIndex]
  const totalParts = parts.length
  const progress = ((currentPartIndex + 1) / totalParts) * 100

  // 모든 파트의 아이템을 플랫 배열로 (조건부 로직 참조용)
  const allItems = parts.flatMap(p => p.items)

  function shouldShowItem(item: HrdSurveyItem): boolean {
    if (!item.conditional_logic?.show_if) return true
    const { item_code, operator, value } = item.conditional_logic.show_if
    const targetItem = allItems.find(i => i.item_code === item_code)
    if (!targetItem) return true
    const answer = answers[targetItem.id]
    if (answer === undefined || answer === null || answer === '') return false
    switch (operator) {
      case 'eq': return String(answer) === String(value)
      case 'neq': return String(answer) !== String(value)
      case 'gt': return Number(answer) > Number(value)
      case 'lt': return Number(answer) < Number(value)
      case 'in': {
        const vals = Array.isArray(value) ? value.map(String) : String(value).split(',').map(s => s.trim())
        return vals.includes(String(answer))
      }
      case 'not_in': {
        const vals = Array.isArray(value) ? value.map(String) : String(value).split(',').map(s => s.trim())
        return !vals.includes(String(answer))
      }
      default: return true
    }
  }

  function setAnswer(itemId: string, value: string | number | unknown) {
    setAnswers(prev => ({ ...prev, [itemId]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  async function saveDraft() {
    setSaving(true)
    try {
      const res = await fetch(`/api/hrd/responses/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          respondent_id: respondent.id,
          round_id: round.id,
          answers,
          is_draft: true,
        }),
      })

      if (!res.ok) throw new Error('Save failed')
    } catch (err) {
      console.error('Save error:', err)
      alert('임시 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    // 필수 항목 검증 (조건부 로직으로 숨겨진 항목은 제외)
    const newErrors: Record<string, string> = {}
    for (const part of parts) {
      for (const item of part.items) {
        if (item.is_required && shouldShowItem(item) && !answers[item.id]) {
          newErrors[item.id] = '필수 항목입니다'
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      // 첫 번째 에러가 있는 파트로 이동
      const firstErrorItemId = Object.keys(newErrors)[0]
      const errorPartIndex = parts.findIndex(p =>
        p.items.some(i => i.id === firstErrorItemId)
      )
      if (errorPartIndex >= 0) setCurrentPartIndex(errorPartIndex)
      alert(`${Object.keys(newErrors).length}개의 필수 항목이 미입력되었습니다.`)
      return
    }

    if (!confirm('설문을 최종 제출하시겠습니까? 제출 후에는 수정이 어렵습니다.')) return

    setSaving(true)
    try {
      const res = await fetch(`/api/hrd/responses/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          respondent_id: respondent.id,
          round_id: round.id,
          answers,
          is_draft: false,
        }),
      })

      if (!res.ok) throw new Error('Submit failed')
      setSubmitted(true)
    } catch (err) {
      console.error('Submit error:', err)
      alert('제출 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 제출 완료 화면
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 size={64} className="mx-auto text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold text-stone-900">설문이 완료되었습니다</h1>
          <p className="mt-2 text-stone-500">
            {respondent.company_name}님의 응답이 성공적으로 제출되었습니다.
            <br />귀중한 시간을 내어 참여해 주셔서 감사합니다.
          </p>
          <div className="mt-6 rounded-lg bg-teal-50 p-4 text-sm text-teal-700">
            분석 결과 보고서는 조사 완료 후 별도 안내드릴 예정입니다.
          </div>
        </div>
      </div>
    )
  }

  function renderItem(item: HrdSurveyItem) {
    const value = answers[item.id]
    const error = errors[item.id]

    return (
      <div key={item.id} className={`rounded-lg border p-4 ${error ? 'border-red-200 bg-red-50/30' : 'border-stone-100 bg-white'}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {item.question_group && (
              <span className="text-xs font-medium text-teal-600">{item.question_group}</span>
            )}
            <p className="mt-0.5 text-sm font-medium text-stone-800">
              {item.sub_item_text || item.question_text}
              {item.is_required && <span className="ml-1 text-red-500">*</span>}
            </p>
            {item.help_text && (
              <p className="mt-1 text-xs text-stone-400">{item.help_text}</p>
            )}
          </div>
        </div>

        <div className="mt-3">
          {/* 텍스트 입력 */}
          {item.answer_type === 'text' && (
            <input
              type="text"
              value={(value as string) || ''}
              onChange={e => setAnswer(item.id, e.target.value)}
              placeholder={item.placeholder || '입력해 주세요'}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
          )}

          {/* 숫자 입력 */}
          {(item.answer_type === 'number' || item.answer_type === 'currency' || item.answer_type === 'percent') && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={(value as number) ?? ''}
                onChange={e => setAnswer(item.id, e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="0"
                className="w-48 rounded-lg border border-stone-200 px-3 py-2 text-right text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
              {item.unit && (
                <span className="text-sm text-stone-500">{item.unit}</span>
              )}
            </div>
          )}

          {/* 5점 척도 */}
          {item.answer_type === 'likert_5' && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setAnswer(item.id, n)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                    value === n
                      ? 'border-teal-500 bg-teal-500 text-white'
                      : 'border-stone-200 text-stone-600 hover:border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  {n}
                </button>
              ))}
              <div className="ml-2 flex items-center text-xs text-stone-400">
                <span>1=매우 낮음</span>
                <span className="mx-2">~</span>
                <span>5=매우 높음</span>
              </div>
            </div>
          )}

          {/* 중요도-수행도 */}
          {item.answer_type === 'likert_importance_performance' && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-16 text-xs text-stone-500">중요도</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => {
                        const current = (value as { importance?: number; performance?: number }) || {}
                        setAnswer(item.id, { ...current, importance: n })
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors ${
                        (value as Record<string, number>)?.importance === n
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-stone-200 text-stone-600 hover:border-blue-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 text-xs text-stone-500">수행도</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => {
                        const current = (value as { importance?: number; performance?: number }) || {}
                        setAnswer(item.id, { ...current, performance: n })
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors ${
                        (value as Record<string, number>)?.performance === n
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-stone-200 text-stone-600 hover:border-emerald-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 단일 선택 */}
          {item.answer_type === 'single_choice' && item.answer_options && (
            <div className="space-y-1.5">
              {(item.answer_options as AnswerOption[]).map((opt, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    value === opt.value
                      ? 'border-teal-400 bg-teal-50 text-teal-700'
                      : 'border-stone-100 text-stone-600 hover:border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={item.id}
                    checked={value === opt.value}
                    onChange={() => setAnswer(item.id, opt.value)}
                    className="accent-teal-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}

          {/* 복수 선택 */}
          {item.answer_type === 'multiple_choice' && item.answer_options && (
            <div className="space-y-1.5">
              {(item.answer_options as AnswerOption[]).map((opt, i) => {
                const selected = Array.isArray(value) ? (value as (string | number)[]).includes(opt.value) : false
                return (
                  <label
                    key={i}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                      selected
                        ? 'border-teal-400 bg-teal-50 text-teal-700'
                        : 'border-stone-100 text-stone-600 hover:border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        const current = (Array.isArray(value) ? value : []) as (string | number)[]
                        const next = selected
                          ? current.filter(v => v !== opt.value)
                          : [...current, opt.value]
                        setAnswer(item.id, next)
                      }}
                      className="accent-teal-600"
                    />
                    {opt.label}
                  </label>
                )
              })}
            </div>
          )}

          {/* 년-월 */}
          {item.answer_type === 'year_month' && (
            <input
              type="text"
              value={(value as string) || ''}
              onChange={e => setAnswer(item.id, e.target.value)}
              placeholder="예: 5년 3개월"
              className="w-40 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
          )}

          {/* 이메일 */}
          {item.answer_type === 'email' && (
            <input
              type="email"
              value={(value as string) || ''}
              onChange={e => setAnswer(item.id, e.target.value)}
              placeholder="example@company.com"
              className="w-64 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
          )}

          {/* 전화번호 */}
          {item.answer_type === 'phone' && (
            <input
              type="tel"
              value={(value as string) || ''}
              onChange={e => setAnswer(item.id, e.target.value)}
              placeholder="02-000-0000"
              className="w-48 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
            />
          )}
        </div>

        {error && (
          <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
            <AlertCircle size={12} /> {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 상단 헤더 */}
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold text-stone-900">{round.title}</h1>
              <p className="text-xs text-stone-400">{respondent.company_name}</p>
            </div>
            <button
              onClick={saveDraft}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? '저장 중...' : '임시 저장'}
            </button>
          </div>
          {/* 프로그레스 바 */}
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-stone-400">
              {currentPartIndex + 1} / {totalParts}
            </span>
          </div>
        </div>
      </div>

      {/* 설문 내용 */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        {currentPart && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-stone-900">{currentPart.part_name}</h2>
              {currentPart.description && (
                <p className="mt-1 text-sm text-stone-500">{currentPart.description}</p>
              )}
            </div>

            <div className="space-y-4">
              {currentPart.items.filter(shouldShowItem).map(item => renderItem(item))}
            </div>
          </>
        )}

        {/* 네비게이션 */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setCurrentPartIndex(Math.max(0, currentPartIndex - 1))}
            disabled={currentPartIndex === 0}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
            이전
          </button>

          {currentPartIndex < totalParts - 1 ? (
            <button
              onClick={() => {
                saveDraft()
                setCurrentPartIndex(currentPartIndex + 1)
              }}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              다음
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Send size={16} />
              {saving ? '제출 중...' : '최종 제출'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
