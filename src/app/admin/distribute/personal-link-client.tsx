'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Copy, Check, Download, Link2, Loader2, ArrowLeft, XCircle,
} from 'lucide-react'
import { parseDistributionCsv, decodeCSVBuffer, type ParsedRow } from '@/lib/csv/parse-distribution-csv'
import { createDistributionBatch } from './actions'
import EmailSendPanel from './email-send-panel'

interface SurveyItem {
  id: string
  title: string
  token: string
  status: string
  classGroups: { id: string; name: string; token: string }[]
}

interface DistributionResult {
  name: string
  email: string
  uniqueToken: string
}

type Step = 'upload' | 'preview' | 'processing' | 'result'

const BASE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

export default function PersonalLinkClient({ surveys }: { surveys: SurveyItem[] }) {
  const [step, setStep] = useState<Step>('upload')
  const [selectedSurveyId, setSelectedSurveyId] = useState(surveys[0]?.id ?? '')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [results, setResults] = useState<DistributionResult[]>([])
  const [batchId, setBatchId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId)

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
    setStep('preview')
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

  const validRows = parsedRows.filter((r) => r.emailValid)
  const invalidRows = parsedRows.filter((r) => !r.emailValid)

  const handleGenerate = async () => {
    if (!selectedSurveyId || validRows.length === 0) return
    setStep('processing')
    setError(null)

    try {
      const result = await createDistributionBatch({
        surveyId: selectedSurveyId,
        rows: validRows,
      })

      if ('error' in result) {
        setError(result.error as string)
        setStep('preview')
        return
      }

      setBatchId(result.batchId)
      setResults(result.distributions)
      setStep('result')
    } catch (err) {
      setError('링크 생성 중 오류가 발생했습니다')
      setStep('preview')
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
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

  const resetAll = () => {
    setStep('upload')
    setParsedRows([])
    setResults([])
    setBatchId('')
    setError(null)
    setFileName('')
  }

  if (surveys.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Link2 size={40} className="mx-auto text-stone-300 mb-3" />
          <p className="text-sm text-stone-400">배포 가능한 설문이 없습니다</p>
          <p className="text-xs text-stone-400 mt-1">설문을 생성하고 활성화하면 개인 링크를 배포할 수 있습니다</p>
        </CardContent>
      </Card>
    )
  }

  // ─── Upload Step ───
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <Card>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-teal-600" />
              CSV 파일 업로드
            </CardTitle>
            <CardDescription>
              설문대상 CSV 파일을 업로드하면 개인별 고유 링크를 자동 생성합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                isDragOver
                  ? 'border-teal-400 bg-teal-50'
                  : 'border-stone-300 hover:border-stone-400 bg-stone-50'
              }`}
              onClick={() => document.getElementById('csv-input')?.click()}
            >
              <Upload size={36} className={`mx-auto mb-3 ${isDragOver ? 'text-teal-500' : 'text-stone-400'}`} />
              <p className="text-sm font-medium text-stone-700">
                CSV 파일을 여기에 드래그하거나 클릭하여 선택
              </p>
              <p className="text-xs text-stone-400 mt-1">
                필수 컬럼: 회사, 담당자, 이메일
              </p>
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
                <AlertTriangle size={14} />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Preview Step ───
  if (step === 'preview') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>데이터 미리보기</CardTitle>
                <CardDescription className="mt-1">
                  {fileName} · {selectedSurvey?.title}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={resetAll}>
                <ArrowLeft size={14} className="mr-1" />
                다시 선택
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* 요약 */}
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
              <div className="text-sm text-stone-400">
                전체 {parsedRows.length}건
              </div>
            </div>

            {/* 테이블 */}
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
                    <tr
                      key={idx}
                      className={`border-b border-stone-100 ${!row.emailValid ? 'bg-rose-50/50' : ''}`}
                    >
                      <td className="px-3 py-2 text-stone-400">{row.rowNumber}</td>
                      <td className="px-3 py-2 text-stone-700">{row.company}</td>
                      <td className="px-3 py-2 text-stone-700">{row.name}</td>
                      <td className="px-3 py-2 text-stone-700 font-mono text-xs">
                        {row.email || <span className="text-stone-400 italic">없음</span>}
                      </td>
                      <td className="px-3 py-2 text-stone-700 font-mono text-xs">{row.phoneNormalized}</td>
                      <td className="px-3 py-2 text-center">
                        {row.emailValid ? (
                          <Badge variant="success" className="text-[11px]">유효</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[11px]">제외</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-rose-600">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={validRows.length === 0}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Link2 size={14} className="mr-1.5" />
                {validRows.length}건 링크 생성
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Processing Step ───
  if (step === 'processing') {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Loader2 size={36} className="mx-auto text-teal-600 animate-spin mb-4" />
          <p className="text-sm font-medium text-stone-700">개인 링크를 생성하고 있습니다...</p>
          <p className="text-xs text-stone-400 mt-1">{validRows.length}건의 응답자 등록 및 링크 발급 중</p>
        </CardContent>
      </Card>
    )
  }

  // ─── Result Step ───
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                링크 생성 완료
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
                <Download size={14} className="mr-1" />
                CSV 다운로드
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
                  <th className="text-center px-3 py-2 text-stone-500 font-medium w-16"></th>
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
                      <td className="px-3 py-2 font-mono text-xs text-teal-700 truncate max-w-[300px]">
                        {link}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => copyToClipboard(link, r.uniqueToken)}
                          className="text-stone-400 hover:text-stone-700 transition-colors"
                        >
                          {copiedId === r.uniqueToken ? (
                            <Check size={14} className="text-emerald-600" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={resetAll}>
              새로운 배포 생성
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 메일 발송 패널 */}
      <EmailSendPanel
        batchId={batchId}
        surveyId={selectedSurveyId}
        results={results}
      />
    </div>
  )
}
