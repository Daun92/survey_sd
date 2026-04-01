'use client'

import { useState, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Copy, Check, Printer, Link2, QrCode, Upload, FileSpreadsheet,
  AlertTriangle, CheckCircle2, XCircle, Download, Loader2, ArrowLeft,
  ChevronRight, Eye, Mail, Users, Trash2, UserPlus, ExternalLink, Send,
} from 'lucide-react'
import { parseDistributionCsv, decodeCSVBuffer, type ParsedRow } from '@/lib/csv/parse-distribution-csv'
import { createDistributionBatch, addToDistributionBatch, getDistributions, deleteDistributionBatch, resendDistributionEmail, resendBatchEmails } from './actions'
import EmailSendPanel from './email-send-panel'

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
  educationType: string | null
  sessionName: string | null
  classGroups: ClassGroup[]
}

const eduTypeLabel: Record<string, string> = {
  classroom: '집합',
  remote: '원격',
  online: '온라인',
  blended: '블렌디드',
}

interface BatchItem {
  id: string
  surveyId: string
  surveyTitle: string
  surveyStatus: string
  channel: string
  totalCount: number
  sentCount: number
  openedCount: number
  completedCount: number
  createdAt: string
}

interface DistributionResult {
  name: string
  email: string
  uniqueToken: string
}

type PersonalStep = 'idle' | 'preview' | 'processing' | 'result'

const BASE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

const statusLabel: Record<string, { text: string; color: string }> = {
  pending: { text: '대기', color: 'bg-stone-100 text-stone-600' },
  sent: { text: '발송됨', color: 'bg-blue-100 text-blue-700' },
  opened: { text: '열람', color: 'bg-amber-100 text-amber-700' },
  started: { text: '응답중', color: 'bg-teal-100 text-teal-700' },
  completed: { text: '완료', color: 'bg-emerald-100 text-emerald-700' },
  failed: { text: '실패', color: 'bg-rose-100 text-rose-700' },
}

export default function DistributeTabs({ surveys, batches: initialBatches }: { surveys: SurveyItem[]; batches: BatchItem[] }) {
  const [selectedSurveyId, setSelectedSurveyId] = useState(surveys[0]?.id ?? '')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // 개인 링크 상태
  const [personalStep, setPersonalStep] = useState<PersonalStep>('idle')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [results, setResults] = useState<DistributionResult[]>([])
  const [batchId, setBatchId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // 추가 대상자 상태
  const [addingMore, setAddingMore] = useState(false)
  const [addMoreParsedRows, setAddMoreParsedRows] = useState<ParsedRow[]>([])
  const [addMoreFileName, setAddMoreFileName] = useState('')
  const [addMoreProcessing, setAddMoreProcessing] = useState(false)
  const [addMoreError, setAddMoreError] = useState<string | null>(null)

  // 배치 이력 상태
  const [batches, setBatches] = useState<BatchItem[]>(initialBatches)
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [batchDistributions, setBatchDistributions] = useState<any[]>([])
  const [loadingBatchId, setLoadingBatchId] = useState<string | null>(null)
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendResult, setResendResult] = useState<{ id: string; success?: boolean; error?: string } | null>(null)
  const [batchResending, setBatchResending] = useState(false)
  const [emailPanelBatchId, setEmailPanelBatchId] = useState<string | null>(null)

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId)
  const surveyUrl = selectedSurvey ? `${BASE_URL}/s/${selectedSurvey.token}` : ''

  const validRows = parsedRows.filter((r) => r.emailValid)
  const invalidRows = parsedRows.filter((r) => !r.emailValid)

  // ─── 공통 유틸 ───
  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ─── 개인 링크 핸들러 ───
  const handleFile = useCallback(async (file: File) => {
    setError(null)
    if (!file.name.endsWith('.csv')) {
      setError('CSV 파일만 업로드 가능합니다')
      return
    }
    const buffer = await file.arrayBuffer()
    const text = decodeCSVBuffer(buffer)
    const rows = parseDistributionCsv(text)
    if (rows.length === 0) {
      setError('유효한 데이터가 없습니다. CSV 형식을 확인해주세요.')
      return
    }
    setParsedRows(rows)
    setFileName(file.name)
    setPersonalStep('preview')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleGenerate = async () => {
    if (!selectedSurveyId || validRows.length === 0) return
    setPersonalStep('processing')
    setError(null)
    try {
      const result = await createDistributionBatch({
        surveyId: selectedSurveyId,
        rows: validRows,
      })
      if ('error' in result) {
        setError(result.error as string)
        setPersonalStep('preview')
        return
      }
      setBatchId(result.batchId)
      setResults(result.distributions)
      setBatches((prev) => [{
        id: result.batchId,
        surveyId: selectedSurveyId,
        surveyTitle: selectedSurvey?.title ?? '',
        surveyStatus: selectedSurvey?.status ?? '',
        channel: 'personal_link',
        totalCount: result.distributions.length,
        sentCount: 0, openedCount: 0, completedCount: 0,
        createdAt: new Date().toISOString(),
      }, ...prev])
      setPersonalStep('result')
    } catch {
      setError('링크 생성 중 오류가 발생했습니다')
      setPersonalStep('preview')
    }
  }

  const resetPersonal = () => {
    setPersonalStep('idle')
    setParsedRows([])
    setResults([])
    setBatchId('')
    setError(null)
    setFileName('')
  }

  // ─── 추가 대상자 핸들러 ───
  const handleAddMoreFile = useCallback(async (file: File) => {
    setAddMoreError(null)
    if (!file.name.endsWith('.csv')) {
      setAddMoreError('CSV 파일만 업로드 가능합니다')
      return
    }
    const buffer = await file.arrayBuffer()
    const text = decodeCSVBuffer(buffer)
    const rows = parseDistributionCsv(text)
    if (rows.length === 0) {
      setAddMoreError('유효한 데이터가 없습니다.')
      return
    }
    setAddMoreParsedRows(rows)
    setAddMoreFileName(file.name)
  }, [])

  const handleAddMoreSubmit = async () => {
    const validAddRows = addMoreParsedRows.filter((r) => r.emailValid)
    if (!batchId || !selectedSurveyId || validAddRows.length === 0) return
    setAddMoreProcessing(true)
    setAddMoreError(null)
    try {
      const result = await addToDistributionBatch({
        batchId,
        surveyId: selectedSurveyId,
        rows: validAddRows,
      })
      if ('error' in result) {
        setAddMoreError(result.error as string)
        setAddMoreProcessing(false)
        return
      }
      // 기존 결과에 병합
      setResults((prev) => [...prev, ...result.distributions])
      // 배치 totalCount 업데이트
      setBatches((prev) =>
        prev.map((b) =>
          b.id === batchId
            ? { ...b, totalCount: b.totalCount + result.distributions.length }
            : b
        )
      )
      // 추가 상태 초기화
      setAddingMore(false)
      setAddMoreParsedRows([])
      setAddMoreFileName('')
    } catch {
      setAddMoreError('추가 대상자 등록 중 오류가 발생했습니다')
    } finally {
      setAddMoreProcessing(false)
    }
  }

  const resetAddMore = () => {
    setAddingMore(false)
    setAddMoreParsedRows([])
    setAddMoreFileName('')
    setAddMoreError(null)
  }

  const copyAllLinks = async () => {
    const text = results
      .map((r) => `${r.name}\t${r.email}\t${BASE_URL}/d/${r.uniqueToken}`)
      .join('\n')
    await copyToClipboard(text, 'all')
  }

  const downloadCSV = () => {
    const bom = '\uFEFF'
    const header = '담당자,이메일,개인 링크\n'
    const body = results
      .map((r) => `"${r.name}","${r.email}","${BASE_URL}/d/${r.uniqueToken}"`)
      .join('\n')
    const blob = new Blob([bom + header + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `배포링크_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── 배치 이력 핸들러 ───
  const toggleBatchDetail = async (id: string) => {
    if (expandedBatchId === id) {
      setExpandedBatchId(null)
      setBatchDistributions([])
      return
    }
    setLoadingBatchId(id)
    try {
      const dists = await getDistributions(id)
      setBatchDistributions(dists)
      setExpandedBatchId(id)
    } catch {
      setError('배치 상세 조회에 실패했습니다')
    } finally {
      setLoadingBatchId(null)
    }
  }

  const handleDeleteBatch = async (id: string) => {
    if (!confirm('이 배치를 삭제하시겠습니까? 포함된 모든 개인 링크가 삭제됩니다.')) return
    setDeletingBatchId(id)
    try {
      const result = await deleteDistributionBatch(id)
      if ('error' in result) {
        setError(result.error as string)
      } else {
        setBatches((prev) => prev.filter((b) => b.id !== id))
        if (expandedBatchId === id) {
          setExpandedBatchId(null)
          setBatchDistributions([])
        }
      }
    } catch {
      setError('배치 삭제에 실패했습니다')
    } finally {
      setDeletingBatchId(null)
    }
  }

  // ─── 빈 설문 ───
  if (surveys.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-stone-800">배부 관리</h1>
          <p className="text-sm text-stone-500 mt-1">설문 배포 링크를 생성하고 관리하세요</p>
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

  // ─── 개인 링크 미리보기 오버레이 (preview / processing / result) ───
  if (personalStep !== 'idle') {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-stone-800">배부 관리</h1>
          <p className="text-sm text-stone-500 mt-1">설문 배포 링크를 생성하고 관리하세요</p>
        </div>

        {/* Preview */}
        {personalStep === 'preview' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>데이터 미리보기</CardTitle>
                    <CardDescription className="mt-1">{fileName} · {selectedSurvey?.title}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={resetPersonal}>
                    <ArrowLeft size={14} className="mr-1" /> 돌아가기
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 mb-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span className="text-stone-700">유효 <strong>{validRows.length}</strong>건</span>
                  </div>
                  {invalidRows.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <XCircle size={14} className="text-rose-500" />
                      <span className="text-stone-700">제외 <strong>{invalidRows.length}</strong>건 (이메일 누락)</span>
                    </div>
                  )}
                  <div className="text-sm text-stone-400">전체 {parsedRows.length}건</div>
                </div>
                <div className="overflow-x-auto border border-stone-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="text-left px-3 py-2 text-stone-500 font-medium w-10">#</th>
                        <th className="text-left px-3 py-2 text-stone-500 font-medium">회사</th>
                        <th className="text-left px-3 py-2 text-stone-500 font-medium">담당자</th>
                        <th className="text-left px-3 py-2 text-stone-500 font-medium">이메일</th>
                        <th className="text-left px-3 py-2 text-stone-500 font-medium">전화</th>
                        <th className="text-center px-3 py-2 text-stone-500 font-medium w-16">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className={`border-b border-stone-100 ${!row.emailValid ? 'bg-rose-50/50' : ''}`}>
                          <td className="px-3 py-2 text-stone-400">{row.rowNumber}</td>
                          <td className="px-3 py-2 text-stone-700">{row.company}</td>
                          <td className="px-3 py-2 text-stone-700">{row.name}</td>
                          <td className="px-3 py-2 text-stone-700 font-mono text-xs">
                            {row.email || <span className="text-stone-400 italic">없음</span>}
                          </td>
                          <td className="px-3 py-2 text-stone-700 font-mono text-xs">{row.phoneNormalized}</td>
                          <td className="px-3 py-2 text-center">
                            {row.emailValid
                              ? <Badge variant="success" className="text-[11px]">유효</Badge>
                              : <Badge variant="destructive" className="text-[11px]">제외</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {error && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-rose-600">
                    <AlertTriangle size={14} />{error}
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleGenerate} disabled={validRows.length === 0} className="bg-teal-600 hover:bg-teal-700 text-white">
                    <Link2 size={14} className="mr-1.5" />{validRows.length}건 링크 생성
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Processing */}
        {personalStep === 'processing' && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 size={36} className="mx-auto text-teal-600 animate-spin mb-4" />
              <p className="text-sm font-medium text-stone-700">개인 링크를 생성하고 있습니다...</p>
              <p className="text-xs text-stone-400 mt-1">{validRows.length}건의 응답자 등록 및 링크 발급 중</p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {personalStep === 'result' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-600" /> 링크 생성 완료
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {results.length}건의 개인 링크가 생성되었습니다 · {selectedSurvey?.title}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyAllLinks}>
                      {copiedId === 'all' ? <Check size={14} className="mr-1 text-emerald-600" /> : <Copy size={14} className="mr-1" />}
                      {copiedId === 'all' ? '복사됨' : '전체 복사'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadCSV}>
                      <Download size={14} className="mr-1" /> CSV 다운로드
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-stone-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="text-left px-3 py-2 text-stone-500 font-medium w-10">#</th>
                        <th className="text-left px-3 py-2 text-stone-500 font-medium">담당자</th>
                        <th className="text-left px-3 py-2 text-stone-500 font-medium">이메일</th>
                        <th className="text-left px-3 py-2 text-stone-500 font-medium">개인 링크</th>
                        <th className="text-center px-3 py-2 text-stone-500 font-medium w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, idx) => {
                        const link = `${BASE_URL}/d/${r.uniqueToken}`
                        return (
                          <tr key={r.uniqueToken} className="border-b border-stone-100">
                            <td className="px-3 py-2 text-stone-400">{idx + 1}</td>
                            <td className="px-3 py-2 text-stone-700">{r.name}</td>
                            <td className="px-3 py-2 text-stone-700 font-mono text-xs">{r.email}</td>
                            <td className="px-3 py-2 font-mono text-xs text-teal-700 truncate max-w-[300px]">{link}</td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <a href={link} target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-teal-600 transition-colors" title="응답자 화면 미리보기">
                                  <ExternalLink size={14} />
                                </a>
                                <button onClick={() => copyToClipboard(link, r.uniqueToken)} className="text-stone-400 hover:text-stone-700 transition-colors" title="링크 복사">
                                  {copiedId === r.uniqueToken ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAddingMore(true)} className="text-teal-600 border-teal-200 hover:bg-teal-50">
                    <UserPlus size={14} className="mr-1" /> 추가 대상자
                  </Button>
                  <Button variant="outline" onClick={resetPersonal}>돌아가기</Button>
                </div>

                {/* 추가 대상자 CSV 업로드 영역 */}
                {addingMore && (
                  <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-teal-700">추가 대상자 업로드</p>
                      <button onClick={resetAddMore} className="text-xs text-stone-400 hover:text-stone-600">취소</button>
                    </div>

                    {addMoreParsedRows.length === 0 ? (
                      <div
                        className="border-2 border-dashed border-teal-300 rounded-lg p-6 text-center cursor-pointer hover:border-teal-400 transition-colors"
                        onClick={() => document.getElementById('csv-add-more')?.click()}
                      >
                        <Upload size={24} className="mx-auto mb-1 text-teal-400" />
                        <p className="text-sm text-teal-700">CSV 파일을 클릭하여 선택</p>
                        <p className="text-xs text-stone-400 mt-1">필수 컬럼: 회사, 담당자, 이메일</p>
                        <input
                          id="csv-add-more"
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleAddMoreFile(file)
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-3 text-sm">
                          <span className="text-stone-500">{addMoreFileName}</span>
                          <span className="text-emerald-600">유효 {addMoreParsedRows.filter((r) => r.emailValid).length}건</span>
                          {addMoreParsedRows.filter((r) => !r.emailValid).length > 0 && (
                            <span className="text-rose-500">제외 {addMoreParsedRows.filter((r) => !r.emailValid).length}건</span>
                          )}
                        </div>
                        <div className="overflow-x-auto border border-stone-200 rounded-lg bg-white max-h-40 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-stone-50 border-b border-stone-200">
                                <th className="text-left px-2 py-1.5 text-stone-500 font-medium">회사</th>
                                <th className="text-left px-2 py-1.5 text-stone-500 font-medium">담당자</th>
                                <th className="text-left px-2 py-1.5 text-stone-500 font-medium">이메일</th>
                                <th className="text-center px-2 py-1.5 text-stone-500 font-medium w-12">상태</th>
                              </tr>
                            </thead>
                            <tbody>
                              {addMoreParsedRows.map((row, idx) => (
                                <tr key={idx} className={`border-b border-stone-100 ${!row.emailValid ? 'bg-rose-50/50' : ''}`}>
                                  <td className="px-2 py-1.5 text-stone-700">{row.company}</td>
                                  <td className="px-2 py-1.5 text-stone-700">{row.name}</td>
                                  <td className="px-2 py-1.5 text-stone-600 font-mono">{row.email || <span className="text-stone-400">없음</span>}</td>
                                  <td className="px-2 py-1.5 text-center">
                                    {row.emailValid
                                      ? <span className="text-emerald-600">✓</span>
                                      : <span className="text-rose-500">✗</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setAddMoreParsedRows([]); setAddMoreFileName('') }}>
                            다시 선택
                          </Button>
                          <Button
                            size="sm"
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                            onClick={handleAddMoreSubmit}
                            disabled={addMoreProcessing || addMoreParsedRows.filter((r) => r.emailValid).length === 0}
                          >
                            {addMoreProcessing ? (
                              <><Loader2 size={12} className="mr-1 animate-spin" />추가 중...</>
                            ) : (
                              <><UserPlus size={12} className="mr-1" />{addMoreParsedRows.filter((r) => r.emailValid).length}건 추가</>
                            )}
                          </Button>
                        </div>
                      </>
                    )}

                    {addMoreError && (
                      <div className="flex items-center gap-2 text-sm text-rose-600">
                        <AlertTriangle size={14} />{addMoreError}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <EmailSendPanel batchId={batchId} surveyId={selectedSurveyId} results={results} />
          </div>
        )}
      </div>
    )
  }

  // ─── 메인 통합 뷰 ───
  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">배부 관리</h1>
          <p className="text-sm text-stone-500 mt-1">설문 배포 링크를 생성하고 관리하세요</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer size={16} className="mr-1.5" /> QR 인쇄
        </Button>
      </div>

      <div className="space-y-6">
        {/* ① 설문 선택 (공통) */}
        <Card>
          <CardContent className="p-5">
            <label className="text-sm font-medium text-stone-700 mb-2 block">설문 선택</label>
            <select
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
              value={selectedSurveyId}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
            >
              {surveys.map((s) => {
                const eduLabel = s.educationType ? eduTypeLabel[s.educationType] : null
                const parts = [s.title]
                if (eduLabel) parts.push(`[${eduLabel}]`)
                if (s.sessionName) parts.push(`- ${s.sessionName}`)
                return (
                  <option key={s.id} value={s.id}>{parts.join(' ')}</option>
                )
              })}
            </select>
          </CardContent>
        </Card>

        {/* ② 공통 링크 / QR */}
        {selectedSurvey && (
          <div ref={printRef}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <QrCode size={18} className="text-teal-600" />
                      공통 설문 링크
                    </CardTitle>
                    <CardDescription className="mt-1">
                      QR코드를 교육장에 게시하거나 링크를 수강생에게 공유하세요
                    </CardDescription>
                  </div>
                  <Badge variant={selectedSurvey.status === 'active' ? 'success' : 'outline'}>
                    {selectedSurvey.status === 'active' ? '활성' : '초안'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-8">
                  <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex-shrink-0">
                    <QRCodeSVG value={surveyUrl} size={160} level="H" includeMargin={false} />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">설문 URL</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 font-mono truncate">
                          {surveyUrl}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(surveyUrl, 'main')}>
                          {copiedId === 'main' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          {copiedId === 'main' ? ' 복사됨' : ' 복사'}
                        </Button>
                      </div>
                    </div>

                    {/* 분반별 링크 (있을 때만) */}
                    {selectedSurvey.classGroups.length > 0 && (
                      <div>
                        <label className="text-xs text-stone-500 mb-2 block">분반별 링크</label>
                        <div className="space-y-1.5">
                          {selectedSurvey.classGroups.map((group) => {
                            const groupUrl = `${BASE_URL}/s/${selectedSurvey.token}?group=${group.token}`
                            return (
                              <div key={group.id} className="flex items-center gap-2">
                                <span className="text-sm text-stone-700 w-24 flex-shrink-0 truncate">{group.name}</span>
                                <div className="flex-1 bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5 text-xs text-stone-600 font-mono truncate">
                                  {groupUrl}
                                </div>
                                <button
                                  onClick={() => copyToClipboard(groupUrl, group.id)}
                                  className="text-stone-400 hover:text-stone-700 transition-colors flex-shrink-0 p-1"
                                >
                                  {copiedId === group.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ③ 개인 링크 생성 (CSV 업로드) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-teal-600" />
              개인 링크 생성
            </CardTitle>
            <CardDescription>
              CSV 파일을 업로드하면 응답자별 고유 링크를 자동 생성합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                isDragOver
                  ? 'border-teal-400 bg-teal-50'
                  : 'border-stone-300 hover:border-stone-400 bg-stone-50'
              }`}
              onClick={() => document.getElementById('csv-input')?.click()}
            >
              <Upload size={32} className={`mx-auto mb-2 ${isDragOver ? 'text-teal-500' : 'text-stone-400'}`} />
              <p className="text-sm font-medium text-stone-700">
                CSV 파일을 여기에 드래그하거나 클릭하여 선택
              </p>
              <p className="text-xs text-stone-400 mt-1">필수 컬럼: 회사, 담당자, 이메일</p>
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-rose-600">
                <AlertTriangle size={14} />{error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ④ 배부 이력 (선택한 설문 기준) */}
        {(() => {
          const filteredBatches = batches.filter(b => b.surveyId === selectedSurveyId)
          return filteredBatches.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={18} className="text-stone-600" />
                배부 이력
              </CardTitle>
              <CardDescription>선택한 설문의 개인 링크 배치를 확인하고 관리합니다</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-stone-100">
                {filteredBatches.map((batch) => {
                  const isExpanded = expandedBatchId === batch.id
                  const isLoading = loadingBatchId === batch.id
                  const isDeleting = deletingBatchId === batch.id
                  return (
                    <div key={batch.id}>
                      <div
                        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-stone-50 ${isExpanded ? 'bg-stone-50' : ''}`}
                        onClick={() => toggleBatchDetail(batch.id)}
                      >
                        <ChevronRight
                          size={16}
                          className={`text-stone-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-stone-800 truncate">{batch.surveyTitle}</span>
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">{batch.totalCount}건</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-stone-400">
                            <span>{new Date(batch.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            {batch.sentCount > 0 && <span className="flex items-center gap-0.5"><Mail size={10} /> 발송 {batch.sentCount}</span>}
                            {batch.openedCount > 0 && <span className="flex items-center gap-0.5"><Eye size={10} /> 열람 {batch.openedCount}</span>}
                            {batch.completedCount > 0 && <span className="flex items-center gap-0.5"><CheckCircle2 size={10} /> 완료 {batch.completedCount}</span>}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteBatch(batch.id) }}
                          disabled={isDeleting}
                          className="p-1.5 text-stone-300 hover:text-rose-500 transition-colors rounded-md hover:bg-rose-50 flex-shrink-0"
                          title="배치 삭제"
                        >
                          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>

                      {isLoading && (
                        <div className="px-5 py-6 text-center bg-stone-50/50">
                          <Loader2 size={20} className="mx-auto text-stone-400 animate-spin" />
                        </div>
                      )}
                      {isExpanded && !isLoading && batchDistributions.length > 0 && (
                        <div className="px-5 pb-4 bg-stone-50/50">
                          <div className="overflow-x-auto border border-stone-200 rounded-lg bg-white">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-stone-50 border-b border-stone-200">
                                  <th className="text-left px-3 py-2 text-stone-500 font-medium w-10">#</th>
                                  <th className="text-left px-3 py-2 text-stone-500 font-medium">담당자</th>
                                  <th className="text-left px-3 py-2 text-stone-500 font-medium">이메일</th>
                                  <th className="text-left px-3 py-2 text-stone-500 font-medium">개인 링크</th>
                                  <th className="text-center px-3 py-2 text-stone-500 font-medium w-16">상태</th>
                                  <th className="text-center px-3 py-2 text-stone-500 font-medium w-20"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {batchDistributions.map((d: any, idx: number) => {
                                  const link = `${BASE_URL}/d/${d.unique_token}`
                                  const st = statusLabel[d.status] ?? { text: d.status, color: 'bg-stone-100 text-stone-600' }
                                  return (
                                    <tr key={d.id} className="border-b border-stone-100 last:border-0">
                                      <td className="px-3 py-2 text-stone-400">{idx + 1}</td>
                                      <td className="px-3 py-2 text-stone-700">{d.recipient_name}</td>
                                      <td className="px-3 py-2 text-stone-600 font-mono text-xs">{d.recipient_email || '-'}</td>
                                      <td className="px-3 py-2 font-mono text-xs text-teal-700 truncate max-w-[260px]">
                                        <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                          /d/{d.unique_token?.slice(0, 12)}…
                                        </a>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.color}`}>{st.text}</span>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                          {d.status !== 'completed' && d.recipient_email && (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation()
                                                setResendingId(d.id)
                                                setResendResult(null)
                                                const res = await resendDistributionEmail(d.id)
                                                setResendResult({ id: d.id, ...res })
                                                setResendingId(null)
                                                if (res.success) {
                                                  const dists = await getDistributions(batch.id)
                                                  setBatchDistributions(dists)
                                                }
                                              }}
                                              disabled={resendingId === d.id}
                                              className="text-stone-400 hover:text-teal-600 transition-colors"
                                              title={resendResult?.id === d.id && resendResult?.error ? resendResult.error : "재발송"}
                                            >
                                              {resendingId === d.id
                                                ? <Loader2 size={13} className="animate-spin" />
                                                : resendResult?.id === d.id && resendResult?.success
                                                  ? <CheckCircle2 size={13} className="text-emerald-500" />
                                                  : resendResult?.id === d.id && resendResult?.error
                                                    ? <XCircle size={13} className="text-rose-500" />
                                                    : <Send size={13} />}
                                            </button>
                                          )}
                                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-teal-600 transition-colors" title="응답자 화면 미리보기">
                                            <ExternalLink size={13} />
                                          </a>
                                          <button onClick={() => copyToClipboard(link, d.id)} className="text-stone-400 hover:text-stone-700 transition-colors" title="링크 복사">
                                            {copiedId === d.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex gap-2 mt-3 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-teal-700 border-teal-200 hover:bg-teal-50 mr-auto"
                              onClick={async () => {
                                if (!confirm('미응답자에게 설문 안내 메일을 재발송하시겠습니까?')) return
                                setBatchResending(true)
                                setResendResult(null)
                                const res = await resendBatchEmails(batch.id)
                                setBatchResending(false)
                                if (res.error) {
                                  setError(res.error)
                                } else {
                                  const dists = await getDistributions(batch.id)
                                  setBatchDistributions(dists)
                                  alert(`${res.sent ?? 0}건 발송 완료${res.failed ? `, ${res.failed}건 실패` : ''}`)
                                }
                              }}
                              disabled={batchResending}
                            >
                              {batchResending
                                ? <Loader2 size={13} className="mr-1 animate-spin" />
                                : <Send size={13} className="mr-1" />}
                              미응답자 재발송
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => {
                              const text = batchDistributions
                                .map((d: any) => `${d.recipient_name}\t${d.recipient_email ?? ''}\t${BASE_URL}/d/${d.unique_token}`)
                                .join('\n')
                              copyToClipboard(text, `batch-${batch.id}`)
                            }}>
                              {copiedId === `batch-${batch.id}` ? <Check size={13} className="mr-1 text-emerald-600" /> : <Copy size={13} className="mr-1" />}
                              {copiedId === `batch-${batch.id}` ? '복사됨' : '전체 복사'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => {
                              const bom = '\uFEFF'
                              const header = '담당자,이메일,개인 링크,상태\n'
                              const body = batchDistributions
                                .map((d: any) => `"${d.recipient_name}","${d.recipient_email ?? ''}","${BASE_URL}/d/${d.unique_token}","${d.status}"`)
                                .join('\n')
                              const blob = new Blob([bom + header + body], { type: 'text/csv;charset=utf-8' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `배포링크_${batch.surveyTitle}_${new Date(batch.createdAt).toISOString().slice(0, 10)}.csv`
                              a.click()
                              URL.revokeObjectURL(url)
                            }}>
                              <Download size={13} className="mr-1" /> CSV 다운로드
                            </Button>
                          </div>

                          {/* 이메일 발송 토글 */}
                          <div className="mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-stone-600 border-stone-200"
                              onClick={() => setEmailPanelBatchId(emailPanelBatchId === batch.id ? null : batch.id)}
                            >
                              <Mail size={13} className="mr-1" />
                              {emailPanelBatchId === batch.id ? '이메일 발송 닫기' : '이메일 발송 / 테스트 발송'}
                            </Button>
                          </div>

                          {emailPanelBatchId === batch.id && (
                            <div className="mt-3">
                              <EmailSendPanel
                                batchId={batch.id}
                                surveyId={batch.surveyId}
                                results={batchDistributions.map((d: any) => ({
                                  name: d.recipient_name ?? '',
                                  email: d.recipient_email ?? '',
                                  uniqueToken: d.unique_token ?? '',
                                }))}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {isExpanded && !isLoading && batchDistributions.length === 0 && (
                        <div className="px-5 py-4 text-center text-sm text-stone-400 bg-stone-50/50">배부 데이터가 없습니다</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          ) : null
        })()}
      </div>
    </div>
  )
}
