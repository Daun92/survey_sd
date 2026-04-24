"use client"

import { useState, useEffect } from "react"
import { Smartphone, Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, TestTube, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getSmsProviders, saveSmsProvider, deleteSmsProvider, testSmsProvider } from "./sms-actions"

type ProviderType = 'aligo' | 'ppurio' | 'naver_cloud' | 'twilio'

interface ProviderItem {
  id: string
  name: string
  provider_type: ProviderType
  sender_phone: string | null
  is_default: boolean
  created_at: string
}

const PROVIDER_LABELS: Record<ProviderType, string> = {
  aligo: '알리고',
  ppurio: '뿌리오',
  naver_cloud: '네이버 클라우드',
  twilio: 'Twilio',
}

const PROVIDER_COLORS: Record<ProviderType, string> = {
  aligo: 'bg-green-100 text-green-700',
  ppurio: 'bg-purple-100 text-purple-700',
  naver_cloud: 'bg-emerald-100 text-emerald-700',
  twilio: 'bg-red-100 text-red-700',
}

export default function SmsProviderSettings() {
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // 폼 상태
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<ProviderType>('aligo')
  const [formApiKey, setFormApiKey] = useState('')
  const [formApiUserId, setFormApiUserId] = useState('')
  const [formSenderPhone, setFormSenderPhone] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const loadProviders = async () => {
    setLoading(true)
    const data = await getSmsProviders()
    setProviders(data as ProviderItem[])
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await getSmsProviders()
      if (cancelled) return
      setProviders(data as ProviderItem[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const resetForm = () => {
    setFormName('')
    setFormType('aligo')
    setFormApiKey('')
    setFormApiUserId('')
    setFormSenderPhone('')
    setFormIsDefault(false)
    setFormError(null)
    setTestResult(null)
    setEditId(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError('이름을 입력하세요')
      return
    }
    setSaving(true)
    setFormError(null)

    const result = await saveSmsProvider({
      id: editId ?? undefined,
      name: formName,
      providerType: formType,
      apiKey: formApiKey || undefined,
      apiUserId: formApiUserId || undefined,
      senderPhone: formSenderPhone || undefined,
      isDefault: formIsDefault,
    })

    setSaving(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    resetForm()
    await loadProviders()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 SMS 제공자를 삭제하시겠습니까?')) return
    setDeleting(id)
    await deleteSmsProvider(id)
    setDeleting(null)
    await loadProviders()
  }

  const handleTest = async () => {
    if (!testPhone.trim()) {
      setTestResult({ error: '테스트 수신 전화번호를 입력하세요' })
      return
    }
    setTesting(true)
    setTestResult(null)
    const result = await testSmsProvider({
      providerType: formType,
      apiKey: formApiKey || undefined,
      apiUserId: formApiUserId || undefined,
      senderPhone: formSenderPhone || undefined,
      testPhone,
    })
    setTestResult(result)
    setTesting(false)
  }

  const openEditForm = (p: ProviderItem) => {
    setEditId(p.id)
    setFormName(p.name)
    setFormType(p.provider_type)
    setFormApiKey('')
    setFormApiUserId('')
    setFormSenderPhone(p.sender_phone ?? '')
    setFormIsDefault(p.is_default)
    setFormError(null)
    setTestResult(null)
    setShowForm(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Smartphone size={18} className="text-stone-600" />
              SMS 제공자 설정
            </CardTitle>
            <CardDescription>문자 메시지 발송에 사용할 서비스를 설정합니다</CardDescription>
          </div>
          {!showForm && (
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setShowForm(true) }}>
              <Plus size={14} className="mr-1" /> 제공자 추가
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* 등록된 제공자 목록 */}
        {loading ? (
          <div className="py-6 text-center"><Loader2 size={20} className="mx-auto text-stone-400 animate-spin" /></div>
        ) : providers.length === 0 && !showForm ? (
          <div className="py-6 text-center text-sm text-stone-400">
            등록된 SMS 제공자가 없습니다. 알리고 등 SMS API를 등록하세요.
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-stone-200 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-800">{p.name}</span>
                    <Badge variant="outline" className={`text-[10px] ${PROVIDER_COLORS[p.provider_type]}`}>
                      {PROVIDER_LABELS[p.provider_type]}
                    </Badge>
                    {p.is_default && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                        <Star size={8} className="mr-0.5" /> 기본
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    발신번호: {p.sender_phone || '-'}
                  </div>
                </div>
                <button
                  onClick={() => openEditForm(p)}
                  className="text-stone-400 hover:text-stone-700 transition-colors text-xs px-2 py-1 rounded hover:bg-stone-100"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={deleting === p.id}
                  className="text-stone-300 hover:text-rose-500 transition-colors p-1 rounded hover:bg-rose-50"
                >
                  {deleting === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 추가/수정 폼 */}
        {showForm && (
          <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-teal-700">{editId ? '제공자 수정' : '새 SMS 제공자 추가'}</p>
              <button onClick={resetForm} className="text-xs text-stone-400 hover:text-stone-600">취소</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">이름</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  placeholder="예: 회사 알리고"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">유형</label>
                <select
                  className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as ProviderType)}
                >
                  <option value="aligo">알리고</option>
                  <option value="ppurio">뿌리오</option>
                  <option value="naver_cloud">네이버 클라우드</option>
                  <option value="twilio">Twilio</option>
                </select>
              </div>
            </div>

            {(formType === 'aligo' || formType === 'ppurio') && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">
                      {formType === 'ppurio' ? 'API 토큰' : 'API Key'}
                    </label>
                    <input
                      type="password"
                      className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                      placeholder={editId ? '(변경 시에만 입력)' : ''}
                      value={formApiKey}
                      onChange={(e) => setFormApiKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">
                      {formType === 'ppurio' ? '뿌리오 계정' : 'User ID'}
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                      value={formApiUserId}
                      onChange={(e) => setFormApiUserId(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">발신번호</label>
                  <input
                    type="tel"
                    className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                    placeholder="01012345678"
                    value={formSenderPhone}
                    onChange={(e) => setFormSenderPhone(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-stone-400">
                  {formType === 'ppurio'
                    ? '뿌리오(ppurio.com)에서 API 토큰 확인 및 발신번호 등록이 필요합니다.'
                    : '발신번호는 알리고 대시보드에서 사전 등록이 필요합니다. 미등록 번호로는 발송이 거부됩니다.'}
                </p>
              </>
            )}

            {formType !== 'aligo' && formType !== 'ppurio' && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs text-amber-700">
                  {PROVIDER_LABELS[formType]} 연동은 준비 중입니다. 현재는 알리고 또는 뿌리오만 지원됩니다.
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="rounded border-stone-300"
              />
              기본 제공자로 설정
            </label>

            {/* 테스트 발송 */}
            <div className="flex items-center gap-2 pt-2 border-t border-stone-200">
              <input
                type="tel"
                className="flex-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm"
                placeholder="테스트 수신 전화번호"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || (formType !== 'aligo' && formType !== 'ppurio')}>
                {testing ? <Loader2 size={13} className="mr-1 animate-spin" /> : <TestTube size={13} className="mr-1" />}
                테스트
              </Button>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                {testResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {testResult.success ? '테스트 SMS 발송 성공' : testResult.error}
              </div>
            )}

            {formError && (
              <div className="flex items-center gap-2 text-sm text-rose-600">
                <AlertTriangle size={14} />{formError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>취소</Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
                {editId ? '수정' : '등록'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
