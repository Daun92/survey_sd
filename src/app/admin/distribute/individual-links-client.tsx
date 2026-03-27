'use client'

import { useState, useTransition, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Trash2, Link2, Copy, Check, Users, ChevronDown, ChevronUp,
  ClipboardList, Loader2, ExternalLink, Download, Upload,
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
  recipient_company: string | null
  recipient_department: string | null
  recipient_position: string | null
  recipient_phone: string | null
  unique_token: string
  status: string
  opened_at: string | null
  completed_at: string | null
  created_at: string
}

interface RecipientRow {
  company: string
  name: string
  position: string
  department: string
  phone: string
  email: string
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
    { company: '', name: '', position: '', department: '', phone: '', email: '' },
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── CSV 샘플 다운로드 ───
  const downloadCsvSample = () => {
    const bom = '\uFEFF'
    const header = '회사,이름,직책,소속,연락처,이메일'
    const rows = [
      'ABC주식회사,홍길동,과장,경영지원팀,010-1234-5678,hong@example.com',
      'ABC주식회사,김영희,대리,인사팀,010-2345-6789,kim@example.com',
      'XYZ코퍼레이션,이철수,부장,마케팅팀,,',
    ]
    const csv = bom + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '수신자_샘플.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── CSV 파일 import ───
  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) {
        setError('CSV 파일에 데이터가 없습니다. 헤더 행 아래에 수신자 정보를 입력해 주세요.')
        return
      }

      // 첫 행은 헤더로 간주하고 건너뜀
      const parsed: RecipientRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i])
        // 컬럼 순서: 회사, 이름, 직책, 소속, 연락처, 이메일
        const name = cols[1]?.trim() || ''
        if (!name) continue
        parsed.push({
          company: cols[0]?.trim() || '',
          name,
          position: cols[2]?.trim() || '',
          department: cols[3]?.trim() || '',
          phone: cols[4]?.trim() || '',
          email: cols[5]?.trim() || '',
        })
      }

      if (parsed.length === 0) {
        setError('CSV 파일에서 유효한 수신자를 찾을 수 없습니다. 이름 열은 필수입니다.')
        return
      }

      if (parsed.length > 100) {
        setError(`최대 100명까지 등록 가능합니다. (현재 ${parsed.length}명)`)
        return
      }

      setRecipients(parsed)
      setError(null)
      setSuccessMsg(`CSV에서 ${parsed.length}명의 수신자를 불러왔습니다`)
      setTimeout(() => setSuccessMsg(null), 3000)
    }
    reader.readAsText(file, 'UTF-8')

    // 같은 파일 재선택 허용
    e.target.value = ''
  }

  // CSV 라인 파서 (쉼표 구분, 큰따옴표 지원)
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (char === '"') {
          inQuotes = false
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          result.push(current)
          current = ''
        } else {
          current += char
        }
      }
    }
    result.push(current)
    return result
  }

  // ─── 수신자 입력 ───
  const addRecipientRow = () => {
    setRecipients([...recipients, { company: '', name: '', position: '', department: '', phone: '', email: '' }])
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
    setRecipients(names.map(name => ({ company: '', name, position: '', department: '', phone: '', email: '' })))
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
          company: r.company.trim() || null,
          name: r.name.trim(),
          position: r.position.trim() || null,
          department: r.department.trim() || null,
          phone: r.phone.trim() || null,
          email: r.email.trim() || null,
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
      setRecipients([{ company: '', name: '', position: '', department: '', phone: '', email: '' }])
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

          {/* 입력 모드 토글 + CSV 버튼 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-stone-700">수신자 입력</label>
              <button
                onClick={() => setBulkMode(!bulkMode)}
                className="text-xs text-teal-600 hover:text-teal-700 underline"
              >
                {bulkMode ? '개별 입력으로 전환' : '일괄 붙여넣기'}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={downloadCsvSample}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-stone-600 hover:bg-stone-100 border border-stone-200 transition-colors"
                title="CSV 샘플 다운로드"
              >
                <Download size={13} />
                샘플 CSV
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-teal-700 hover:bg-teal-50 border border-teal-200 transition-colors"
                title="CSV 파일 불러오기"
              >
                <Upload size={13} />
                CSV 불러오기
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvImport}
                className="hidden"
              />
            </div>
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
            <div className="space-y-2 overflow-x-auto">
              {/* 헤더 */}
              <div className="grid grid-cols-[120px_100px_80px_100px_120px_160px_36px] gap-1.5 text-xs text-stone-500 font-medium px-1 min-w-[740px]">
                <span>회사</span>
                <span>이름 *</span>
                <span>직책</span>
                <span>소속</span>
                <span>연락처</span>
                <span>이메일</span>
                <span></span>
              </div>
              {recipients.map((r, i) => (
                <div key={i} className="grid grid-cols-[120px_100px_80px_100px_120px_160px_36px] gap-1.5 min-w-[740px]">
                  <Input
                    placeholder="회사"
                    value={r.company}
                    onChange={(e) => updateRecipient(i, 'company', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="이름"
                    value={r.name}
                    onChange={(e) => updateRecipient(i, 'name', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="직책"
                    value={r.position}
                    onChange={(e) => updateRecipient(i, 'position', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="소속"
                    value={r.department}
                    onChange={(e) => updateRecipient(i, 'department', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="연락처"
                    value={r.phone}
                    onChange={(e) => updateRecipient(i, 'phone', e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="이메일"
                    value={r.email}
                    onChange={(e) => updateRecipient(i, 'email', e.target.value)}
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
                            <div className="bg-white border border-stone-200 rounded-lg overflow-x-auto">
                              <table className="w-full text-sm min-w-[800px]">
                                <thead>
                                  <tr className="bg-stone-50 border-b border-stone-100">
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500">회사</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500">이름</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500">직책</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500">소속</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500">연락처</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-stone-500">이메일</th>
                                    <th className="text-center px-3 py-2 text-xs font-semibold text-stone-500">응답</th>
                                    <th className="text-center px-3 py-2 text-xs font-semibold text-stone-500">링크</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {distributions.map((d) => {
                                    const url = `${BASE_URL}/d/${d.unique_token}`
                                    const st = statusConfig[d.status] ?? { label: d.status, variant: 'outline' as const }
                                    return (
                                      <tr key={d.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50">
                                        <td className="px-3 py-2.5 text-stone-600 text-xs">
                                          {d.recipient_company || '-'}
                                        </td>
                                        <td className="px-3 py-2.5 font-medium text-stone-800 whitespace-nowrap">
                                          {d.recipient_name || '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-stone-600 text-xs">
                                          {d.recipient_position || '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-stone-600 text-xs">
                                          {d.recipient_department || '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-stone-600 text-xs whitespace-nowrap">
                                          {d.recipient_phone || '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-stone-600 text-xs">
                                          {d.recipient_email || '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          <Badge variant={st.variant}>{st.label}</Badge>
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
