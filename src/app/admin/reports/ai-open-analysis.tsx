'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'

interface OpenResponseAnalysis {
  summary: string
  keywords: string[]
  positive: string[]
  negative: string[]
  actionItems: string[]
}

export function AIOpenAnalysis({ responses }: { responses: string[] }) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<OpenResponseAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (responses.length < 3) return null

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/analyze-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: '교육과정에 대한 의견',
          responses,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '분석에 실패했습니다')
        return
      }
      setAnalysis(data.analysis)
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  if (!analysis) {
    return (
      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading} className="text-xs">
          {loading ? (
            <><Loader2 size={12} className="mr-1 animate-spin" />분석 중...</>
          ) : (
            <><Sparkles size={12} className="mr-1 text-teal-500" />AI 분석 ({responses.length}건)</>
          )}
        </Button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }

  return (
    <div className="mb-4 space-y-3">
      {/* 요약 */}
      <div className="bg-teal-50 rounded-lg p-3">
        <p className="text-xs font-semibold text-teal-700 mb-1">AI 요약</p>
        <p className="text-sm text-stone-700">{analysis.summary}</p>
      </div>

      {/* 키워드 */}
      <div className="flex flex-wrap gap-1.5">
        {analysis.keywords.map((kw, i) => (
          <span key={i} className="text-xs bg-stone-100 text-stone-600 rounded-full px-2.5 py-0.5">
            {kw}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 긍정 */}
        <div className="bg-emerald-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-emerald-700 mb-1.5">긍정 의견</p>
          <ul className="space-y-1">
            {analysis.positive.map((p, i) => (
              <li key={i} className="text-xs text-stone-600">+ {p}</li>
            ))}
          </ul>
        </div>

        {/* 부정 */}
        <div className="bg-amber-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1.5">개선 의견</p>
          <ul className="space-y-1">
            {analysis.negative.map((n, i) => (
              <li key={i} className="text-xs text-stone-600">- {n}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 권고사항 */}
      {analysis.actionItems.length > 0 && (
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-stone-600 mb-1.5">개선 권고사항</p>
          <ul className="space-y-1">
            {analysis.actionItems.map((a, i) => (
              <li key={i} className="text-xs text-stone-600">{i + 1}. {a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
