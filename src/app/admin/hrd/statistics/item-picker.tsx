'use client'

/**
 * 항목별 distribution 패널에 결합되는 좌측 트리.
 *
 * Part 별로 펼쳐서 item 클릭 → ?item=<id> URL 동기화. server page 가 그 id 로
 * `get_hrd_item_distribution` RPC 호출 + distribution-card 렌더.
 */

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'

interface PickerItem {
  id: string
  item_code: string
  sub_item_text: string | null
  question_text: string
  question_group: string | null
  answer_type: string
  sort_order: number
}

interface PickerPart {
  id: string
  part_code: string
  part_name: string
  sort_order: number
  items: PickerItem[]
}

interface Props {
  parts: PickerPart[]
  selectedItemId: string | null
}

export function ItemPicker({ parts, selectedItemId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openParts, setOpenParts] = useState<Set<string>>(() => {
    // 선택된 item 의 part 는 자동으로 열림
    const initial = new Set<string>()
    if (selectedItemId) {
      const target = parts.find((p) =>
        p.items.some((i) => i.id === selectedItemId)
      )
      if (target) initial.add(target.id)
    } else if (parts.length > 0) {
      initial.add(parts[0]!.id)
    }
    return initial
  })
  const [query, setQuery] = useState('')

  function togglePart(id: string) {
    setOpenParts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectItem(id: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('item', id)
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  // 검색 필터
  const q = query.trim().toLowerCase()
  const filtered = parts
    .map((p) => ({
      ...p,
      items: q
        ? p.items.filter(
            (i) =>
              i.item_code.toLowerCase().includes(q) ||
              (i.sub_item_text ?? '').toLowerCase().includes(q) ||
              (i.question_text ?? '').toLowerCase().includes(q)
          )
        : p.items,
    }))
    .filter((p) => !q || p.items.length > 0)

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2">
        <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2 py-1.5">
          <Search size={14} className="text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="item_code · 하위항목 검색"
            className="w-full bg-transparent text-xs outline-none placeholder:text-stone-400"
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {filtered.map((part) => {
          const open = openParts.has(part.id) || !!q
          return (
            <div key={part.id} className="mb-1">
              <button
                type="button"
                onClick={() => togglePart(part.id)}
                className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="font-mono text-[10px] text-stone-400">
                  {part.part_code}
                </span>
                <span className="truncate">{part.part_name}</span>
                <span className="ml-auto text-[10px] text-stone-400">
                  {part.items.length}
                </span>
              </button>
              {open && (
                <div className="ml-2 border-l border-stone-100 pl-2">
                  {part.items.map((it) => {
                    const isSel = it.id === selectedItemId
                    const label =
                      it.sub_item_text ||
                      it.question_text ||
                      it.item_code
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => selectItem(it.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] ${
                          isSel
                            ? 'bg-teal-50 text-teal-700'
                            : 'text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        <span className="font-mono text-[9px] text-stone-400 w-24 truncate shrink-0">
                          {it.item_code}
                        </span>
                        <span className="truncate min-w-0 flex-1">{label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
