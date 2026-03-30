'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Copy, Printer, Link2, QrCode, Check, Plus, Trash2, Loader2, UserPlus, Users, ExternalLink } from 'lucide-react'
import { createPersonalLinks, deleteBatch } from './actions'

interface ClassGroup {
  id: string
  name: string
  token: string
}

interface SurveyItem {
  id: string
  title: string
  token: string
  status: string
  classGroups: ClassGroup[]
}

interface Distribution {
  id: string
  batch_id: string | null
  survey_id: string
  recipient_name: string | null
  recipient_email: string | null
  recipient_company: string | null
  recipient_department: string | null
  unique_token: string | null
  status: string | null
  created_at: string | null
  distribution_batches: { title: string } | null
}

interface RecipientRow {
  name: string
  email: string
  company: string
  department: string
  position: string
  phone: string
}

const BASE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

const emptyRecipient = (): RecipientRow => ({ name: '', email: '', company: '', department: '', position: '', phone: '' })

export default function DistributeClient({ surveys, distributions }: { surveys: SurveyItem[]; distributions: Distribution[] }) {
  const router = useRouter()
  const [selectedSurveyId, setSelectedSurveyId] = useState(surveys[0]?.id ?? '')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // 개인 링크 생성 상태
  const [showPersonalForm, setShowPersonalForm] = useState(false)
  const [recipients, setRecipients] = useState<RecipientRow[]>([emptyRecipient()])
  const [batchTitle, setBatchTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null)

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId)

  // 현재 선택된 설문의 배포 데이터
  const surveyDistributions = distributions.filter((d) => d.survey_id === selectedSurveyId)
  const batchGroups: Record<string, Distribution[]> = {}
  surveyDistributions.forEach((d) => {
    const key = d.batch_id || 'no-batch'
    if (!batchGroups[key]) batchGroups[key] = []
    batchGroups[key].push(d)
  })

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handlePrint = () => window.print()

  const addRecipient = () => setRecipients([...recipients, emptyRecipient()])
  const removeRecipient = (idx: number) => {
    if (recipients.length <= 1) return
    setRecipients(recipients.filter((_, i) => i !== idx))
  }
  const updateRecipient = (idx: number, field: keyof RecipientRow, value: string) => {
    const updated = [...recipients]
    updated[idx] = { ...updated[idx], [field]: value }
    setRecipients(updated)
  }

  const handleCreateLinks = async () => {
    const validRecipients = recipients.filter((r) => r.name.trim())
    if (validRecipients.length === 0) {
      alert('수신자 이름을 1명 이상 입력해 주세요.')
      return
    }
    setCreating(true)
    try {
      const result = await createPersonalLinks(
        selectedSurveyId,
        validRecipients.map((r) => ({
          recipient_name: r.name.trim(),
          recipient_email: r.email.trim() || undefined,
          recipient_company: r.company.trim() || undefined,
          recipient_department: r.department.trim() || undefined,
          recipient_position: r.position.trim() || undefined,
          recipient_phone: r.phone.trim() || undefined,
        })),
        batchTitle.trim() || undefined
      )
      alert(`${result.count}명의 개인 링크가 생성되었습니다.`)
      setRecipients([emptyRecipient()])
      setBatchTitle('')
      setShowPersonalForm(false)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : '개인 링크 생성에 실패했습니다.')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('이 배치의 모든 개인 링크를 삭제하시겠습니까?')) return
    setDeletingBatchId(batchId)
    try {
      await deleteBatch(batchId)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeletingBatchId(null)
    }
  }

  if (surveys.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-stone-800">배부 관리</h1>
          <p className="text-sm text-stone-500 mt-1">설문 URL, QR코드, 개인별 링크를 생성하여 배포하세요</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <QrCode size={40} className="mx-auto text-stone-300 mb-3" />
            <p className="text-sm text-stone-400">배포 가능한 설문이 없습니다</p>
            <p className="text-xs text-stone-400 mt-1">설문을 생성하고 활성화하면 배포할 수 있습니다</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!selectedSurvey) return null

  const surveyUrl = `${BASE_URL}/s/${selectedSurvey.token}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-800">배부 관리</h1>
          <p className="text-sm text-stone-500 mt-1">설문 URL, QR코드, 개인별 링크를 생성하여 배포하세요</p>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer size={16} className="mr-1.5" />
          QR 인쇄
        </Button>
      </div>

      {/* Survey Selector */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <label className="text-sm font-medium text-stone-700 mb-2 block">설문 선택</label>
          <Select
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
          >
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <div ref={printRef} className="space-y-6">
        {/* Main Survey QR */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <QrCode size={18} className="text-teal-600" />
                  통합 설문 링크
                </CardTitle>
                <CardDescription className="mt-1">
                  분반 구분 없이 응답을 수집하려면 아래 통합 링크를 사용하세요
                </CardDescription>
              </div>
              <Badge variant={selectedSurvey.status === 'active' ? 'success' : 'outline'}>
                {selectedSurvey.status === 'active' ? '활성' : '초안'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-8">
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                <QRCodeSVG
                  value={surveyUrl}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">설문 URL</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 font-mono truncate">
                      {surveyUrl}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(surveyUrl, 'main')}
                    >
                      {copiedId === 'main' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copiedId === 'main' ? '복사됨' : '복사'}
                    </Button>
                  </div>
                </div>
                <div className="bg-teal-50 rounded-lg p-3">
                  <p className="text-xs text-teal-700">
                    <strong>안내:</strong> 이 QR코드를 교육장에 게시하거나, 링크를 수강생에게 공유하세요.
                    모바일에서 QR 스캔 시 바로 설문 페이지로 이동합니다.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class Group QRs */}
        {selectedSurvey.classGroups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>분반별 QR코드</CardTitle>
              <CardDescription>분반별로 별도 링크를 생성하여 응답을 구분합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedSurvey.classGroups.map((group) => {
                  const groupUrl = `${BASE_URL}/s/${selectedSurvey.token}?group=${group.token}`
                  return (
                    <div key={group.id} className="border border-stone-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-stone-800">{group.name}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(groupUrl, group.id)}
                        >
                          {copiedId === group.id ? (
                            <><Check size={13} className="text-emerald-600 mr-1" />복사됨</>
                          ) : (
                            <><Link2 size={13} className="mr-1" />링크 복사</>
                          )}
                        </Button>
                      </div>
                      <div className="flex justify-center mb-3">
                        <div className="bg-white p-3 rounded-lg border border-stone-100">
                          <QRCodeSVG value={groupUrl} size={140} level="H" />
                        </div>
                      </div>
                      <p className="text-xs text-stone-500 text-center font-mono truncate">{groupUrl}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── 개인별 링크 관리 ── */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus size={18} className="text-teal-600" />
                  개인별 링크
                </CardTitle>
                <CardDescription className="mt-1">
                  수신자별 고유 링크를 생성하여 개인별 응답을 추적합니다
                </CardDescription>
              </div>
              {!showPersonalForm && (
                <Button onClick={() => setShowPersonalForm(true)}>
                  <Plus size={14} className="mr-1.5" />
                  개인 링크 생성
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* 생성 폼 */}
            {showPersonalForm && (
              <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50/30 p-4">
                <div className="mb-3">
                  <label className="block text-[13px] font-medium text-stone-600 mb-1">배치 제목 (선택)</label>
                  <input
                    type="text"
                    value={batchTitle}
                    onChange={(e) => setBatchTitle(e.target.value)}
                    placeholder="예: 서울 1차 교육생"
                    className="w-full max-w-sm rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div className="mb-2">
                  <label className="block text-[13px] font-medium text-stone-600 mb-1">수신자 목록</label>
                </div>

                <div className="space-y-2">
                  {recipients.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-stone-400 w-5 text-right shrink-0">{idx + 1}.</span>
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => updateRecipient(idx, 'name', e.target.value)}
                        placeholder="이름 *"
                        className="w-28 rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
                      />
                      <input
                        type="email"
                        value={r.email}
                        onChange={(e) => updateRecipient(idx, 'email', e.target.value)}
                        placeholder="이메일"
                        className="w-40 rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
                      />
                      <input
                        type="text"
                        value={r.company}
                        onChange={(e) => updateRecipient(idx, 'company', e.target.value)}
                        placeholder="회사명"
                        className="w-28 rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
                      />
                      <input
                        type="text"
                        value={r.department}
                        onChange={(e) => updateRecipient(idx, 'department', e.target.value)}
                        placeholder="부서"
                        className="w-24 rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
                      />
                      <input
                        type="text"
                        value={r.phone}
                        onChange={(e) => updateRecipient(idx, 'phone', e.target.value)}
                        placeholder="연락처"
                        className="w-28 rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none"
                      />
                      {recipients.length > 1 && (
                        <button onClick={() => removeRecipient(idx)} className="text-stone-400 hover:text-red-500 shrink-0">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={addRecipient}
                    className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                  >
                    <Plus size={13} /> 수신자 추가
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-teal-200">
                  <Button onClick={handleCreateLinks} disabled={creating}>
                    {creating ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
                    {creating ? '생성 중...' : `${recipients.filter(r => r.name.trim()).length}명 링크 생성`}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowPersonalForm(false); setRecipients([emptyRecipient()]); setBatchTitle(''); }}>
                    취소
                  </Button>
                </div>
              </div>
            )}

            {/* 기존 개인 링크 목록 */}
            {Object.keys(batchGroups).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(batchGroups).map(([batchId, dists]) => {
                  const batchTitle = dists[0]?.distribution_batches?.title || '제목 없음'
                  const completedCount = dists.filter(d => d.status === 'completed').length
                  return (
                    <div key={batchId} className="rounded-lg border border-stone-200">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50/80 border-b border-stone-100">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-stone-500" />
                          <span className="text-sm font-semibold text-stone-700">{batchTitle}</span>
                          <span className="text-xs text-stone-400">({dists.length}명)</span>
                          {completedCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              완료 {completedCount}
                            </span>
                          )}
                        </div>
                        {batchId !== 'no-batch' && (
                          <button
                            onClick={() => handleDeleteBatch(batchId)}
                            disabled={deletingBatchId === batchId}
                            className="text-xs text-stone-400 hover:text-red-500 disabled:opacity-50"
                          >
                            {deletingBatchId === batchId ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-stone-100">
                        {dists.map((d) => {
                          const personalUrl = d.unique_token ? `${BASE_URL}/s/${selectedSurvey.token}?t=${d.unique_token}` : null
                          const statusLabel = d.status === 'completed' ? '완료' : d.status === 'started' ? '진행중' : d.status === 'opened' ? '열람' : d.status === 'sent' ? '발송' : '대기'
                          const statusClass = d.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : d.status === 'started' || d.status === 'opened' ? 'bg-blue-100 text-blue-800' : 'bg-stone-100 text-stone-600'
                          return (
                            <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-stone-800">{d.recipient_name || '-'}</span>
                                  {d.recipient_company && <span className="text-xs text-stone-400">{d.recipient_company}</span>}
                                  {d.recipient_department && <span className="text-xs text-stone-400">· {d.recipient_department}</span>}
                                </div>
                                {d.recipient_email && <p className="text-xs text-stone-400">{d.recipient_email}</p>}
                              </div>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${statusClass}`}>
                                {statusLabel}
                              </span>
                              {personalUrl && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => copyToClipboard(personalUrl, d.id)}
                                    className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50"
                                    title="링크 복사"
                                  >
                                    {copiedId === d.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                  </button>
                                  <a
                                    href={personalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50"
                                    title="새 탭에서 열기"
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : !showPersonalForm ? (
              <div className="text-center py-8">
                <UserPlus size={32} className="mx-auto text-stone-300 mb-2" />
                <p className="text-sm text-stone-400">생성된 개인 링크가 없습니다</p>
                <p className="text-xs text-stone-400 mt-0.5">개인 링크를 생성하면 수신자별 응답을 추적할 수 있습니다</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
