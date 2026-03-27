'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Trash2, Link2, Copy, Check, Users, ChevronDown, ChevronUp,
  ClipboardList, Loader2, ExternalLink,
} from 'lucide-react'
import { createDistributionBatch, getDistributions, deleteDistributionBatch } from './actions'

interface SurveyItem {
  id: string
  title: string
  status: string
}

interface BatchItem {
  id: string
  surveyId: string
  surveyTitle: string
  surveyStatus: string
  totalCount: number
  completedCount: number
  createdAt: string
}

interface DistributionItem {
  id: string
  recipient_name: string | null
  recipient_email: string | null
  unique_token: string
  status: string
  opened_at: string | null
  completed_at: string | null
  created_at: string
}

interface RecipientRow {
  name: string
  email: string
  department: string
  position: string
}

const BASE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

const statusConfig: Record<string, { label: string; variant: 'outline' | 'success' | 'warning' | 'default' }> = {
  pending: { label: '대기', variant: 'outline' },
  sent: { label: '발송', variant: 'outline' },
  opened: { label: '열람', variant: 'warning' },
  started: { label: '진행중', variant: 'warning' },
  completed: { label: '완료', variant: 'success' },
}

export default function IndividualLinksClient({
  surveys,
  initialBatches,
}: {
  surveys: SurveyItem[]
  initialBatches: BatchItem[]
}) {
  const [batches, setBatches] = useState<BatchItem[]>(initialBatches)
  const [selectedSurveyId, setSelectedSurveyId] = useState(surveys[0]?.id ?? '')
  const [recipients, setRecipients] = useState<RecipientRow[]>([
    { name: '', email: '', department: '', position: '' },
  ])
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [distributions, setDistributions] = useState<DistributionItem[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isLoadingDist, setIsLoadingDist] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // ─── 수신자 입력 ───
  const addRecipientRow = () => {
    setRecipients([...recipients, { name: '', email: '', department: '', position: '' }])
  }

  const updateRecipient = (index: number, field: keyof RecipientRow, value: string) => {
    setRecipients(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const removeRecipient = (index: number) => {
    if (recipients.length <= 1) return
    setRecipients(prev => prev.filter((_, i) => i !== index))
  }

  const applyBulkText = () => {
    const names = bulkText.split('\n').map(n => n.trim()).filter(Boolean)
    if (names.length === 0) return
    setRecipients(names.map(name => ({ name, email: '', department: '', position: '' })))
    setBulkMode(false)
    setBulkText('')
  }

  // ─── 링크 생성 ───
  const handleCreate = () => {
    const validRecipients = recipients.filter(r => r.name.trim())
    if (!selectedSurveyId || validRecipients.length === 0) {
      setError('설문을 선택하고 최소 1명의 수신자 이름을 입력해 주세요')
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await createDistributionBatch({
        survey_id: selectedSurveyId,
        recipients: validRecipients.map(r => ({
          name: r.name.trim(),
          email: r.email.trim() || null,
          department: r.department.trim() || null,
          position: r.position.trim() || null,
        })),
      })

      if (result.error) {
        setError(result.error)
        return
      }

      // 리스트 갱신: 새 배치를 목록 맨 앞에 추가
      const surveyTitle = surveys.find(s => s.id === selectedSurveyId)?.title ?? ''
      const surveyStatus = surveys.find(s => s.id === selectedSurveyId)?.status ?? ''
      setBatches(prev => [{
        id: result.batchId!,
        surveyId: selectedSurveyId,
        surveyTitle,
        surveyStatus,
        totalCount: validRecipients.length,
        completedCount: 0,
        createdAt: new Date().toISOString(),
      }, ...prev])

      // 입력 초기화
      setRecipients([{ name: '', email: '', department: '', position: '' }])
      setSuccessMsg(`${validRecipients.length}개의 개별 링크가 생성되었습니다`)
      setTimeout(() => setSuccessMsg(null), 3000)

      // 자동으로 새 배치 펼치기
      handleToggleBatch(result.batchId!)
    })
  }

  // ─── 배치 펼침/접기 ───
  const handleToggleBatch = async (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null)
      return
    }
    setIsLoadingDist(true)
    setExpandedBatchId(batchId)
    const dists = await getDistributions(batchId)
    setDistributions(dists)
    setIsLoadingDist(false)
  }

  // ─── 배치 삭제 ───
  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('이 배부 배치를 삭제하시겠습니까? 생성된 모든 링크가 삭제됩니다.')) return
    const result = await deleteDistributionBatch(batchId)
    if (result.error) {
      setError(result.error)
      return
    }
    setBatches(prev => prev.filter(b => b.id !== batchId))
    if (expandedBatchId === batchId) setExpandedBatchId(null)
  }

  // ─── 복사 ───
  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyAllLinks = async (dists: DistributionItem[]) => {
    const text = dists
      .map(d => `${d.recipient_name}\t${BASE_URL}/d/${d.unique_token}`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedId('all')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDate = (d: string | null) => {
    if (!d) return '-'
    return new Date(d).toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* ─── 배부 생성 ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} className="text-teal-600" />
            개별 링크 생성
          </CardTitle>
          <CardDescription>수신자별 고유 링크를 생성하여 개인정보 입력 없이 응답자를 식별합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 설문 선택 */}
          <div>
            <label className="text-sm font-medium text-stone-700 mb-1.5 block">설문 선택</label>
            <Select value={selectedSurveyId} onChange={(e) => setSelectedSurveyId(e.target.value)}>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </Select>
          </div>

          {/* 입력 모드 토글 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-stone-700">수신자 입력</label>
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className="text-xs text-teal-600 hover:text-teal-700 underline"
            >
              {bulkMode ? '개별 입력으로 전환' : '일괄 붙여넣기'}
            </button>
          </div>

          {bulkMode ? (
            <div className="space-y-2">
              <Textarea
                placeholder={"이름을 줄바꿈으로 구분하여 입력하세요\n예:\n홍길동\n김영희\n이철수"}
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <Button variant="outline" size="sm" onClick={applyBulkText}>
                적용 ({bulkText.split('\n').filter(l => l.trim()).length}명)
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* 헤더 */}
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_36px] gap-2 text-xs text-stone-500 font-medium px-1">
                <span>이름 *</span>
                <span>이메일</span>
                <span>부서</span>
                <span>직급</span>
                <span></span>
              </div>
              {recipients.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_36px] gap-2">
                  <Input
                    placeholder="이름"
                    value={r.name}
                    onChange={(e) => updateRecipient(i, 'name', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="이메일"
                    value={r.email}
                    onChange={(e) => updateRecipient(i, 'email', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="부서"
                    value={r.department}
                    onChange={(e) => updateRecipient(i, 'department', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="직급"
                    value={r.position}
                    onChange={(e) => updateRecipient(i, 'position', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <button
                    onClick={() => removeRecipient(i)}
                    className="flex items-center justify-center h-9 w-9 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    disabled={recipients.length <= 1}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRecipientRow}>
                <Plus size={14} className="mr-1" />
                행 추가
              </Button>
            </div>
          )}

          {/* 에러/성공 메시지 */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">{successMsg}</div>
          )}

          {/* 생성 버튼 */}
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending ? (
              <><Loader2 size={16} className="mr-1.5 animate-spin" />생성 중...</>
            ) : (
              <><Link2 size={16} className="mr-1.5" />링크 생성 ({recipients.filter(r => r.name.trim()).length}명)</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ─── 배부 현황 ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList size={18} className="text-teal-600" />
            배부 현황
          </CardTitle>
          <CardDescription>생성된 개별 링크의 응답 현황을 확인합니다</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="py-8 text-center">
              <Link2 size={32} className="mx-auto text-stone-300 mb-2" />
              <p className="text-sm text-stone-400">생성된 배부 배치가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {batches.map((batch) => {
                const isExpanded = expandedBatchId === batch.id
                const completionRate = batch.totalCount > 0
                  ? Math.round((batch.completedCount / batch.totalCount) * 100)
                  : 0

                return (
                  <div key={batch.id} className="border border-stone-200 rounded-xl overflow-hidden">
                    {/* 배치 헤더 */}
                    <button
                      onClick={() => handleToggleBatch(batch.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-800 truncate">{batch.surveyTitle}</p>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {formatDate(batch.createdAt)} · {batch.totalCount}명
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {/* 응답률 */}
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full transition-all"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-stone-600 w-10 text-right">
                            {batch.completedCount}/{batch.totalCount}
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
                      </div>
                    </button>

                    {/* 배치 상세 */}
                    {isExpanded && (
                      <div className="border-t border-stone-100 bg-stone-50/50">
                        {isLoadingDist ? (
                          <div className="py-6 text-center">
                            <Loader2 size={20} className="mx-auto animate-spin text-stone-400" />
                          </div>
                        ) : (
                          <div className="p-4 space-y-3">
                            {/* 액션 버튼 */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyAllLinks(distributions)}
                              >
                                {copiedId === 'all' ? (
                                  <><Check size={13} className="mr-1 text-emerald-600" />전체 복사됨</>
                                ) : (
                                  <><Copy size={13} className="mr-1" />전체 링크 복사</>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteBatch(batch.id)}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 size={13} className="mr-1" />
                                배치 삭제
                              </Button>
                            </div>

                            {/* 개별 목록 */}
                            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-stone-50 border-b border-stone-100">
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500">이름</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500">상태</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500">응답일시</th>
                                    <th className="text-center px-3 py-2 text-xs font-semibold text-stone-500">링크</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {distributions.map((d) => {
                                    const url = `${BASE_URL}/d/${d.unique_token}`
                                    const st = statusConfig[d.status] ?? { label: d.status, variant: 'outline' as const }
                                    return (
                                      <tr key={d.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50">
                                        <td className="px-3 py-2.5 font-medium text-stone-800">
                                          {d.recipient_name || '-'}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <Badge variant={st.variant}>{st.label}</Badge>
                                        </td>
                                        <td className="px-3 py-2.5 text-stone-500 text-xs">
                                          {formatDate(d.completed_at)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center justify-center gap-1">
                                            <button
                                              onClick={() => copyToClipboard(url, d.id)}
                                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-stone-600 hover:bg-stone-100 transition-colors"
                                              title="링크 복사"
                                            >
                                              {copiedId === d.id ? (
                                                <><Check size={12} className="text-emerald-600" />복사됨</>
                                              ) : (
                                                <><Copy size={12} />복사</>
                                              )}
                                            </button>
                                            <a
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="p-1 rounded-md text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                                              title="링크 열기"
                                            >
                                              <ExternalLink size={12} />
                                            </a>
                                          </div>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
