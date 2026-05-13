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

/**
 * 큰 숫자를 사람이 읽기 쉬운 한국식 표기로 변환.
 *
 * - currency: 만/억/조 자동 축약 + 원본 정확값을 보조로 동봉.
 *   예) 1214863520.84 → ['12.15억', '1,214,863,521원']
 * - number  : 정수 천단위 콤마. 큰 숫자는 만/억 축약.
 *   예) 1234 → ['1,234', '']  / 12345678 → ['1,234.57만', '12,345,678']
 * - percent : 100 이내 가정. 소수 1자리.
 * - likert  : 1~5 가정. 소수 2자리.
 *
 * 반환: [표시문자, 보조문자(빈 문자열이면 미표시)]
 */
function formatNumeric(
  v: number | null | undefined,
  type: string
): { display: string; aux: string } {
  if (v === null || v === undefined || Number.isNaN(v)) {
    return { display: '-', aux: '' }
  }
  if (type === 'percent') {
    return { display: Number(v).toFixed(1), aux: '' }
  }
  if (type === 'likert_5' || type === 'likert_importance_performance') {
    return { display: Number(v).toFixed(2), aux: '' }
  }

  const abs = Math.abs(v)
  const exact = Math.round(v).toLocaleString('ko-KR')

  if (type === 'currency') {
    if (abs >= 1e12) return { display: `${(v / 1e12).toFixed(2)}조`, aux: exact }
    if (abs >= 1e8)  return { display: `${(v / 1e8).toFixed(2)}억`,  aux: exact }
    if (abs >= 1e4)  return { display: `${(v / 1e4).toFixed(1)}만`,  aux: exact }
    return { display: exact, aux: '' }
  }

  // number (명/시간 등) — 정수 콤마. 1억 이상이면 축약 + 원본 보조.
  if (abs >= 1e8) return { display: `${(v / 1e8).toFixed(2)}억`, aux: exact }
  if (abs >= 1e4) return { display: `${(v / 1e4).toFixed(1)}만`, aux: exact }
  return { display: exact, aux: '' }
}

/** 두 값 페어 (min/max, q1/q3) — 동일 type 으로 둘 다 포맷. */
function formatNumericPair(
  a: number | null | undefined,
  b: number | null | undefined,
  type: string
): { display: string; aux: string } {
  const fa = formatNumeric(a, type)
  const fb = formatNumeric(b, type)
  const aux = fa.aux || fb.aux
    ? `${fa.aux || fa.display} / ${fb.aux || fb.display}`
    : ''
  return { display: `${fa.display} / ${fb.display}`, aux }
}

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
  const tiles: {
    label: string
    main: string
    aux: string
    suffix: string
  }[] = [
    {
      label: '응답 수',
      main: data.response_count.toLocaleString('ko-KR'),
      aux: '',
      suffix: '명',
    },
    {
      label: '평균',
      ...withSuffix(formatNumeric(data.mean, type), unit),
    },
    {
      label: '중앙값',
      ...withSuffix(formatNumeric(data.median, type), unit),
    },
    {
      label: '표준편차',
      ...withSuffix(formatNumeric(data.stddev, type), unit),
    },
    {
      label: '최소 / 최대',
      ...withSuffix(formatNumericPair(data.min, data.max, type), unit),
    },
    {
      label: 'Q1 / Q3',
      ...withSuffix(formatNumericPair(data.q1, data.q3, type), unit),
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-stone-100 bg-stone-50/40 p-3">
          <p className="text-[11px] text-stone-500">{t.label}</p>
          <p className="mt-1 text-base font-semibold text-stone-800">
            {t.main}
            {t.suffix && (
              <span className="ml-1 text-[11px] font-normal text-stone-400">
                {t.suffix}
              </span>
            )}
          </p>
          {t.aux && (
            <p className="mt-0.5 text-[10px] text-stone-400 tabular-nums">
              {t.aux}
              {t.suffix && (
                <span className="ml-0.5">{t.suffix}</span>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/** `formatNumeric` 결과 + 단위 suffix 를 tile 모양으로 변환. */
function withSuffix(
  fmt: { display: string; aux: string },
  unit: string
): { main: string; aux: string; suffix: string } {
  return { main: fmt.display, aux: fmt.aux, suffix: unit }
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
