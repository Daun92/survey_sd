/**
 * 선택된 item 의 응답 분포 카드 (server-render).
 *
 * `get_hrd_item_distribution` RPC 결과를 받아 answer_type 별로 그린다.
 *  - numeric/likert  → 통계 요약 6칸 (count/mean/median/stddev/min~max/q1~q3)
 *  - single/multi    → 옵션 라벨 매핑된 horizontal bar list
 *  - 텍스트류        → 응답 수 + 샘플 5건
 *
 * 빈 응답(response_count=0) 일 때 안내 표시.
 */

import { Info } from 'lucide-react'
import type { AnswerOption } from '@/types/hrd-survey'

type DistData =
  | NumericDist
  | OptionDist
  | TextDist
  | { type: string; response_count: number }

interface NumericDist {
  type:
    | 'number'
    | 'percent'
    | 'currency'
    | 'likert_5'
    | 'likert_importance_performance'
  response_count: number
  mean: number | null
  median: number | null
  stddev: number | null
  min: number | null
  max: number | null
  q1: number | null
  q3: number | null
}

interface OptionDist {
  type: 'single_choice' | 'multiple_choice'
  response_count: number
  options: { value: string; count: number; percent: number }[]
}

interface TextDist {
  type: 'text' | 'email' | 'phone' | 'year_month' | 'date' | 'comma_separated' | 'rank_order'
  response_count: number
  samples: string[]
}

interface DistResult {
  item_id: string
  answer_type: string
  answer_options: AnswerOption[] | null
  data: DistData
}

interface Props {
  result: DistResult
  itemLabel: string
  itemCode: string
}

const UNIT_BY_TYPE: Record<string, string> = {
  percent: '%',
  currency: '원',
  number: '',
  likert_5: '점',
  likert_importance_performance: '점',
}

const fmt = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined ? '-' : Number(v).toFixed(digits)

export function DistributionCard({ result, itemLabel, itemCode }: Props) {
  const { answer_type, answer_options, data } = result
  const empty = !data || (data as { response_count?: number }).response_count === 0

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-stone-400">{itemCode}</span>
          <span className="text-sm font-semibold text-stone-800">{itemLabel}</span>
          <span className="ml-auto rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
            {answer_type}
          </span>
        </div>
      </div>

      <div className="p-5">
        {empty ? (
          <EmptyState type={answer_type} />
        ) : (
          <DistBody
            type={answer_type}
            data={data}
            options={answer_options ?? []}
          />
        )}
      </div>
    </div>
  )
}

function EmptyState({ type }: { type: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-4 py-3 text-xs text-stone-500">
      <Info size={14} className="text-stone-400" />
      완료 응답자의 응답이 아직 없습니다. ({type})
    </div>
  )
}

function DistBody({
  type,
  data,
  options,
}: {
  type: string
  data: DistData
  options: AnswerOption[]
}) {
  if (
    type === 'number' ||
    type === 'percent' ||
    type === 'currency' ||
    type === 'likert_5' ||
    type === 'likert_importance_performance'
  ) {
    return <NumericStats data={data as NumericDist} type={type} />
  }
  if (type === 'single_choice' || type === 'multiple_choice') {
    return <OptionBars data={data as OptionDist} options={options} type={type} />
  }
  return <TextSamples data={data as TextDist} />
}

function NumericStats({ data, type }: { data: NumericDist; type: string }) {
  const unit = UNIT_BY_TYPE[type] ?? ''
  const tiles = [
    { label: '응답 수', value: data.response_count, suffix: '명' },
    { label: '평균', value: fmt(data.mean), suffix: unit },
    { label: '중앙값', value: fmt(data.median), suffix: unit },
    { label: '표준편차', value: fmt(data.stddev), suffix: unit },
    { label: '최소 / 최대', value: `${fmt(data.min)} / ${fmt(data.max)}`, suffix: unit },
    { label: 'Q1 / Q3', value: `${fmt(data.q1)} / ${fmt(data.q3)}`, suffix: unit },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-stone-100 bg-stone-50/40 p-3">
          <p className="text-[11px] text-stone-500">{t.label}</p>
          <p className="mt-1 text-base font-semibold text-stone-800">
            {String(t.value)}
            {t.suffix && (
              <span className="ml-1 text-[11px] font-normal text-stone-400">
                {t.suffix}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  )
}

function OptionBars({
  data,
  options,
  type,
}: {
  data: OptionDist
  options: AnswerOption[]
  type: string
}) {
  const labelMap = new Map(options.map((o) => [String(o.value), o.label]))
  const ordered = [...(data.options ?? [])].sort((a, b) => b.count - a.count)
  const maxPct = Math.max(1, ...ordered.map((o) => o.percent))

  return (
    <div>
      <p className="mb-2 text-[11px] text-stone-500">
        응답 수: <span className="font-semibold text-stone-700">{data.response_count}</span>
        {type === 'multiple_choice' && (
          <span className="ml-2 text-stone-400">· 복수 선택 (합 100% 초과 가능)</span>
        )}
      </p>
      <ul className="space-y-1.5">
        {ordered.map((opt) => {
          const label = labelMap.get(String(opt.value)) ?? `(${opt.value})`
          const width = (opt.percent / maxPct) * 100
          return (
            <li key={String(opt.value)} className="flex items-center gap-3 text-xs">
              <span className="w-40 truncate text-stone-700" title={label}>
                {label}
              </span>
              <div className="relative flex-1 h-5 rounded-md bg-stone-100">
                <div
                  className="h-full rounded-md bg-teal-400/70"
                  style={{ width: `${width}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-[10px] text-stone-700">
                  {opt.count}회 · {opt.percent}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TextSamples({ data }: { data: TextDist }) {
  return (
    <div>
      <p className="mb-2 text-[11px] text-stone-500">
        응답 수: <span className="font-semibold text-stone-700">{data.response_count}</span>
      </p>
      {data.samples && data.samples.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-stone-100 bg-stone-50/50 p-3">
          {data.samples.map((s, i) => (
            <li key={i} className="text-xs text-stone-700">
              <span className="text-stone-400 mr-2">·</span>
              {s}
            </li>
          ))}
          {data.response_count > data.samples.length && (
            <li className="text-[10px] text-stone-400 mt-1">
              … 그 외 {data.response_count - data.samples.length}건
            </li>
          )}
        </ul>
      ) : (
        <p className="text-xs text-stone-500">샘플 없음</p>
      )}
    </div>
  )
}
