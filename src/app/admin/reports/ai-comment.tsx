'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface ReportDataForAI {
  courseName: string
  sessionName: string
  overallAvg: number
  responseRate: number
  totalResponses: number
  sectionScores: { name: string; avg: number }[]
  questionScores: { code: string; text: string; section: string; avg: number }[]
}

interface ReportComment {
  executiveSummary: string
  strengths: string[]
  improvements: string[]
  moduleAnalysis: string
  instructorAnalysis: string
  recommendation: string
}

export function AIReportComment({ reportData }: { reportData: ReportDataForAI }) {
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState<ReportComment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/report-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'AI 코멘트 생성에 실패했습니다')
        return
      }

      setComment(data.comment)
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (!comment) {
    return (
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
        <CardContent className="p-6 text-center">
          <Sparkles size={24} className="mx-auto text-teal-500 mb-3" />
          <p className="text-sm font-medium text-stone-700 mb-1">AI 리포트 코멘트</p>
          <p className="text-xs text-stone-500 mb-4">
            조사 결과를 분석하여 경영진 요약, 강점/약점, 권고사항을 자동 생성합니다
          </p>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" />
                AI 분석 중...
              </>
            ) : (
              <>
                <Sparkles size={14} className="mr-1.5" />
                AI 코멘트 생성
              </>
            )}
          </Button>
          {error && (
            <div className="mt-3 text-xs text-red-600 bg-rose-50 rounded p-2">{error}</div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles size={16} className="text-teal-500" />
            AI 리포트 코멘트
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={loading}
              className="text-xs"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : '재생성'}
            </Button>
            <button onClick={() => setExpanded(!expanded)} className="text-stone-400 hover:text-stone-600">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {/* 경영진 요약 */}
          <div className="bg-teal-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-2">경영진 요약</p>
            <p className="text-sm text-stone-700 leading-relaxed">{comment.executiveSummary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 강점 */}
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">강점</p>
              <ul className="space-y-1.5">
                {comment.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-stone-700 flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* 개선점 */}
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">개선점</p>
              <ul className="space-y-1.5">
                {comment.improvements.map((s, i) => (
                  <li key={i} className="text-sm text-stone-700 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">-</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 모듈별 분석 */}
          {comment.moduleAnalysis && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">영역별 분석</p>
              <p className="text-sm text-stone-600 leading-relaxed">{comment.moduleAnalysis}</p>
            </div>
          )}

          {/* 강사별 분석 */}
          {comment.instructorAnalysis && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">강사 분석</p>
              <p className="text-sm text-stone-600 leading-relaxed">{comment.instructorAnalysis}</p>
            </div>
          )}

          {/* 권고사항 */}
          <div className="bg-stone-50 rounded-lg p-4 border border-stone-200">
            <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">향후 권고사항</p>
            <p className="text-sm text-stone-700 leading-relaxed">{comment.recommendation}</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
