'use client'

/**
 * Part 카드 내부의 item 목록 패널.
 *
 * 각 item 행은 한 줄(메타) + 펼침(옵션 chip + 응답자 시점 미리보기) 로 구성.
 * 디자이너/관리자가 sub_item·옵션·단위·벤치마크 여부를 한눈에 확인하고,
 * 펼치면 응답자가 보게 될 폼 위젯 (`AnswerTypeInput`) 을 그대로 본다.
 *
 * 미리보기는 local state — 저장/제출 없이 admin 의 시각 점검 용도.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Star, Lock, Filter } from 'lucide-react'
import { AnswerTypeInput } from '@/components/hrd/answer-type-input'
import type {
  HrdSurveyItem,
  HrdAnswerType,
  AnswerOption,
  ConditionalLogic,
} from '@/types/hrd-survey'
import { DesignActions } from './design-actions'

interface PanelItem
  extends Pick<
    HrdSurveyItem,
    | 'id'
    | 'item_code'
    | 'question_text'
    | 'answer_type'
    | 'is_required'
    | 'sort_order'
    | 'conditional_logic'
  > {
  sub_item_text: string | null
  question_group: string | null
  answer_options: AnswerOption[] | null
  unit: string | null
  placeholder: string | null
  help_text: string | null
  is_benchmark_item: boolean
}

interface Props {
  items: PanelItem[]
}

// answer_type 별 한글 라벨 + 배지 색상
const TYPE_META: Record<HrdAnswerType, { label: string; tone: string }> = {
  text:                          { label: '텍스트',       tone: 'bg-stone-100 text-stone-700' },
  number:                        { label: '숫자',         tone: 'bg-sky-100 text-sky-700' },
  percent:                       { label: '비율 %',       tone: 'bg-indigo-100 text-indigo-700' },
  currency:                      { label: '금액 원',      tone: 'bg-amber-100 text-amber-700' },
  single_choice:                 { label: '단일선택',     tone: 'bg-teal-100 text-teal-700' },
  multiple_choice:               { label: '복수선택',     tone: 'bg-emerald-100 text-emerald-700' },
  likert_5:                      { label: '리커트 5점',   tone: 'bg-violet-100 text-violet-700' },
  likert_importance_performance: { label: '중요도-수행도', tone: 'bg-fuchsia-100 text-fuchsia-700' },
  rank_order:                    { label: '순위',         tone: 'bg-orange-100 text-orange-700' },
  comma_separated:               { label: '쉼표구분',     tone: 'bg-stone-100 text-stone-700' },
  year_month:                    { label: '연월',         tone: 'bg-cyan-100 text-cyan-700' },
  email:                         { label: '이메일',       tone: 'bg-pink-100 text-pink-700' },
  phone:                         { label: '전화',         tone: 'bg-pink-100 text-pink-700' },
  date:                          { label: '날짜',         tone: 'bg-cyan-100 text-cyan-700' },
}

// 펼치지 않아도 옵션 개수만 미리 보여줄 타입
const HAS_OPTIONS = new Set<HrdAnswerType>(['single_choice', 'multiple_choice'])

export function PartItemsPanel({ items }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<HrdAnswerType | 'all'>('all')

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 같은 question_group 끼리 인접한 위치 사이에만 묶음 헤더 표시 (시각적 응집)
  const groupRuns = computeGroupRuns(items)

  // 타입 필터
  const filtered =
    filter === 'all' ? items : items.filter((i) => i.answer_type === filter)

  // 사용 가능한 타입만 필터 옵션으로
  const availableTypes = Array.from(
    new Set(items.map((i) => i.answer_type))
  ).sort()

  if (items.length === 0) return null

  return (
    <div className="mt-4 pt-3 border-t border-stone-100">
      {/* 상단 도구 — 타입 필터 + 전체 펼치기 */}
      <div className="mb-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-stone-400" />
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-2 py-0.5 ${
              filter === 'all'
                ? 'bg-stone-800 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            전체 {items.length}
          </button>
          {availableTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-md px-2 py-0.5 ${
                filter === t
                  ? 'bg-stone-800 text-white'
                  : `${TYPE_META[t]?.tone ?? 'bg-stone-100 text-stone-600'} hover:opacity-80`
              }`}
            >
              {TYPE_META[t]?.label ?? t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-stone-400">
          <button
            onClick={() => setExpanded(new Set(filtered.map((i) => i.id)))}
            className="hover:text-stone-700"
          >
            모두 펼치기
          </button>
          <span>·</span>
          <button
            onClick={() => setExpanded(new Set())}
            className="hover:text-stone-700"
          >
            모두 접기
          </button>
        </div>
      </div>

      {/* 문항 리스트 */}
      <div className="space-y-1">
        {filtered.map((item) => {
          const isOpen = expanded.has(item.id)
          const meta = TYPE_META[item.answer_type] ?? {
            label: item.answer_type,
            tone: 'bg-stone-100 text-stone-700',
          }
          const groupHeader =
            filter === 'all' &&
            item.question_group &&
            groupRuns.get(item.id) === 'first'
              ? item.question_group
              : null
          const optionCount = HAS_OPTIONS.has(item.answer_type)
            ? (item.answer_options?.length ?? 0)
            : 0

          return (
            <div key={item.id}>
              {groupHeader && (
                <div className="mt-3 mb-1 pl-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                  {groupHeader}
                </div>
              )}

              <div
                className={`rounded-lg border ${
                  isOpen
                    ? 'border-stone-200 bg-stone-50/50'
                    : 'border-transparent hover:border-stone-100 hover:bg-stone-50/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left"
                >
                  <span className="text-stone-300 shrink-0">
                    {isOpen ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-stone-400 shrink-0 w-32 truncate">
                    {item.item_code}
                  </span>
                  <span className="text-sm text-stone-800 min-w-0 flex-1 truncate">
                    {item.sub_item_text || item.question_text}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                  {item.unit && (
                    <span className="shrink-0 text-[10px] text-stone-400">
                      {item.unit}
                    </span>
                  )}
                  {optionCount > 0 && (
                    <span className="shrink-0 text-[10px] text-stone-400">
                      옵션 {optionCount}
                    </span>
                  )}
                  {item.is_benchmark_item && (
                    <span
                      className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-amber-600"
                      title="벤치마크 항목"
                    >
                      <Star size={10} fill="currentColor" />
                      bm
                    </span>
                  )}
                  {item.is_required && (
                    <span className="shrink-0 text-[10px] text-rose-500">
                      필수
                    </span>
                  )}
                  {item.conditional_logic && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">
                      <Lock size={9} />
                      조건부
                    </span>
                  )}
                </button>

                {isOpen && (
                  <ExpandedDetails item={item} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// 펼침 — 옵션 chip + 미리보기 (AnswerTypeInput)
// ----------------------------------------------------------------------------

function ExpandedDetails({ item }: { item: PanelItem }) {
  const [previewValue, setPreviewValue] = useState<unknown>(undefined)
  const options = item.answer_options ?? []
  const cond = item.conditional_logic as ConditionalLogic | null
  // AnswerTypeInput 이 요구하는 HrdSurveyItem 인터페이스를 만족시키기 위한 최소 객체.
  // help_text 등 사용 안 되는 필드는 적당히 채운다.
  const itemForInput = item as unknown as HrdSurveyItem

  return (
    <div className="px-3 pb-3 pt-1 pl-10 space-y-3">
      {/* 메타 상세 */}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[11px]">
        {item.question_text && (
          <>
            <dt className="text-stone-400">질문 텍스트</dt>
            <dd className="text-stone-700">{item.question_text}</dd>
          </>
        )}
        {item.question_group && (
          <>
            <dt className="text-stone-400">묶음</dt>
            <dd className="text-stone-700">{item.question_group}</dd>
          </>
        )}
        {item.placeholder && (
          <>
            <dt className="text-stone-400">플레이스홀더</dt>
            <dd className="text-stone-500 italic">{item.placeholder}</dd>
          </>
        )}
        {item.help_text && (
          <>
            <dt className="text-stone-400">도움말</dt>
            <dd className="text-stone-500">{item.help_text}</dd>
          </>
        )}
        {cond?.show_if && (
          <>
            <dt className="text-stone-400">표시 조건</dt>
            <dd className="text-amber-700">
              <code className="font-mono">
                {cond.show_if.item_code} {cond.show_if.operator}{' '}
                {String(cond.show_if.value)}
              </code>
            </dd>
          </>
        )}
      </dl>

      {/* 옵션 chip 목록 */}
      {options.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-stone-500 mb-1">
            옵션 ({options.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {options.map((opt, i) => (
              <span
                key={`${i}-${String(opt.value)}`}
                className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-200 px-2 py-0.5 text-[11px] text-stone-600"
              >
                <span className="font-mono text-stone-400">{String(opt.value)}</span>
                <span>·</span>
                <span>{opt.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 응답자 시점 미리보기 */}
      <div>
        <div className="text-[11px] font-medium text-stone-500 mb-1">
          응답자 시점 미리보기
        </div>
        <div className="rounded-md border border-dashed border-stone-200 bg-white p-3">
          <AnswerTypeInput
            item={itemForInput}
            value={previewValue}
            onChange={setPreviewValue}
          />
        </div>
      </div>

      {/* 액션 — 기존 design-actions 의 item 모드 재사용 */}
      <div className="flex justify-end">
        <DesignActions item={item} allItems={[]} mode="item" />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// utilities
// ----------------------------------------------------------------------------

/**
 * 연속된 같은 question_group 중 첫 번째 item id 만 'first' 로 표기.
 * UI 가 그 위에 묶음 헤더를 그릴 수 있게 함.
 */
function computeGroupRuns(items: PanelItem[]): Map<string, 'first' | 'rest'> {
  const runs = new Map<string, 'first' | 'rest'>()
  let lastGroup: string | null = null
  for (const it of items) {
    const g = it.question_group ?? null
    if (g && g !== lastGroup) {
      runs.set(it.id, 'first')
      lastGroup = g
    } else if (g) {
      runs.set(it.id, 'rest')
    } else {
      lastGroup = null
    }
  }
  return runs
}
