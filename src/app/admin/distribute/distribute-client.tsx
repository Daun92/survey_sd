'use client'

import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Copy, Printer, Link2, QrCode, Check, Users } from 'lucide-react'
import IndividualLinksClient from './individual-links-client'

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

interface BatchItem {
  id: string
  surveyId: string
  surveyTitle: string
  surveyStatus: string
  totalCount: number
  completedCount: number
  createdAt: string
}

const BASE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

type Tab = 'qr' | 'individual'

export default function DistributeClient({
  surveys,
  initialBatches,
}: {
  surveys: SurveyItem[]
  initialBatches: BatchItem[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('individual')
  const [selectedSurveyId, setSelectedSurveyId] = useState(surveys[0]?.id ?? '')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId)

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handlePrint = () => window.print()

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-stone-800">배부 관리</h1>
        <p className="text-sm text-stone-500 mt-1">설문을 QR코드 또는 개별 링크로 배부하세요</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-stone-200 mb-6">
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'individual'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <Users size={16} />
          개별 링크 배부
        </button>
        <button
          onClick={() => setActiveTab('qr')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'qr'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <QrCode size={16} />
          QR 배포
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'individual' ? (
        <IndividualLinksClient
          surveys={surveys.map(s => ({ id: s.id, title: s.title, status: s.status }))}
          initialBatches={initialBatches}
        />
      ) : (
        /* QR 배포 (기존 기능) */
        <div>
          {surveys.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <QrCode size={40} className="mx-auto text-stone-300 mb-3" />
                <p className="text-sm text-stone-400">배포 가능한 설문이 없습니다</p>
                <p className="text-xs text-stone-400 mt-1">설문을 생성하고 활성화하면 QR코드를 배포할 수 있습니다</p>
              </CardContent>
            </Card>
          ) : selectedSurvey && (
            <>
              <div className="flex items-center justify-end mb-4">
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
                          value={`${BASE_URL}/s/${selectedSurvey.token}`}
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
                              {`${BASE_URL}/s/${selectedSurvey.token}`}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(`${BASE_URL}/s/${selectedSurvey.token}`, 'main')}
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
