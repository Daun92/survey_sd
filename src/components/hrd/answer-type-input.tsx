'use client'

/**
 * HRD 실태조사 응답자 폼의 문항별 입력 컴포넌트.
 *
 * src/app/hrd/[token]/survey-form.tsx 내부에 인라인으로 200+줄 조건분기로
 * 존재하던 answer_type 별 렌더링을 단일 dispatcher `<AnswerTypeInput>` +
 * 소단위 입력 컴포넌트들로 분리. 각 서브-컴포넌트는 item, value, onChange
 * 만 받는 단순 shape.
 *
 * 지원 answer_type (migration 004 기준 9종):
 *   text | number | currency | percent | likert_5 |
 *   likert_importance_performance | single_choice | multiple_choice |
 *   year_month | email | phone
 */

import type { HrdSurveyItem, AnswerOption } from '@/types/hrd-survey'

interface AnswerInputProps {
  item: HrdSurveyItem
  value: unknown
  onChange: (value: unknown) => void
}

export function AnswerTypeInput({ item, value, onChange }: AnswerInputProps) {
  switch (item.answer_type) {
    case 'text':
      return <TextInput item={item} value={value} onChange={onChange} />
    case 'number':
    case 'currency':
    case 'percent':
      return <NumberInput item={item} value={value} onChange={onChange} />
    case 'likert_5':
      return <Likert5Input value={value} onChange={onChange} />
    case 'likert_importance_performance':
      return <ImportancePerformanceInput value={value} onChange={onChange} />
    case 'single_choice':
      return <SingleChoiceInput item={item} value={value} onChange={onChange} />
    case 'multiple_choice':
      return <MultipleChoiceInput item={item} value={value} onChange={onChange} />
    case 'year_month':
      return <YearMonthInput value={value} onChange={onChange} />
    case 'email':
      return <EmailInput value={value} onChange={onChange} />
    case 'phone':
      return <PhoneInput value={value} onChange={onChange} />
    default:
      return null
  }
}

function TextInput({ item, value, onChange }: AnswerInputProps) {
  return (
    <input
      type="text"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={item.placeholder || '입력해 주세요'}
      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
    />
  )
}

function NumberInput({ item, value, onChange }: AnswerInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={(value as number) ?? ''}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : '')}
        placeholder="0"
        className="w-48 rounded-lg border border-stone-200 px-3 py-2 text-right text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
      />
      {item.unit && <span className="text-sm text-stone-500">{item.unit}</span>}
    </div>
  )
}

function Likert5Input({ value, onChange }: Omit<AnswerInputProps, 'item'>) {
  return (
    <div className="flex gap-2">
      {[5, 4, 3, 2, 1].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
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
        <span>5=매우 높음</span>
        <span className="mx-2">~</span>
        <span>1=매우 낮음</span>
      </div>
    </div>
  )
}

function ImportancePerformanceInput({ value, onChange }: Omit<AnswerInputProps, 'item'>) {
  const current = (value as { importance?: number; performance?: number }) || {}
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="w-16 text-xs text-stone-500">중요도</span>
        <div className="flex gap-1.5">
          {[5, 4, 3, 2, 1].map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...current, importance: n })}
              className={`flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors ${
                current.importance === n
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
          {[5, 4, 3, 2, 1].map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...current, performance: n })}
              className={`flex h-8 w-8 items-center justify-center rounded border text-xs font-medium transition-colors ${
                current.performance === n
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
  )
}

function SingleChoiceInput({ item, value, onChange }: AnswerInputProps) {
  const options = (item.answer_options as AnswerOption[] | null) ?? []
  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
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
            onChange={() => onChange(opt.value)}
            className="accent-teal-600"
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}

function MultipleChoiceInput({ item, value, onChange }: AnswerInputProps) {
  const options = (item.answer_options as AnswerOption[] | null) ?? []
  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => {
        const current = (Array.isArray(value) ? value : []) as (string | number)[]
        const selected = current.includes(opt.value)
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
                const next = selected
                  ? current.filter((v) => v !== opt.value)
                  : [...current, opt.value]
                onChange(next)
              }}
              className="accent-teal-600"
            />
            {opt.label}
          </label>
        )
      })}
    </div>
  )
}

function YearMonthInput({ value, onChange }: Omit<AnswerInputProps, 'item'>) {
  return (
    <input
      type="text"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="예: 5년 3개월"
      className="w-40 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
    />
  )
}

function EmailInput({ value, onChange }: Omit<AnswerInputProps, 'item'>) {
  return (
    <input
      type="email"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="example@company.com"
      className="w-64 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
    />
  )
}

function PhoneInput({ value, onChange }: Omit<AnswerInputProps, 'item'>) {
  return (
    <input
      type="tel"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="02-000-0000"
      className="w-48 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
    />
  )
}
