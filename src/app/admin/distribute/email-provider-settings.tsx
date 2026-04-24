"use client"

import { useState, useEffect } from "react"
import { Settings, Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, TestTube, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getEmailProviders, saveEmailProvider, deleteEmailProvider, testEmailProvider } from "./email-actions"

type ProviderType = 'hiworks' | 'smtp' | 'gmail' | 'outlook'

interface ProviderItem {
  id: string
  name: string
  provider_type: ProviderType
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  from_name: string | null
  from_email: string | null
  is_default: boolean
  created_at: string
}

const PROVIDER_LABELS: Record<ProviderType, string> = {
  hiworks: '하이웍스',
  gmail: 'Gmail SMTP',
  outlook: 'Outlook SMTP',
  smtp: '커스텀 SMTP',
}

const PROVIDER_COLORS: Record<ProviderType, string> = {
  hiworks: 'bg-blue-100 text-blue-700',
  gmail: 'bg-red-100 text-red-700',
  outlook: 'bg-sky-100 text-sky-700',
  smtp: 'bg-stone-100 text-stone-700',
}

export default function EmailProviderSettings() {
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // 폼 상태
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<ProviderType>('gmail')
  const [formHost, setFormHost] = useState('')
  const [formPort, setFormPort] = useState(587)
  const [formSecure, setFormSecure] = useState(false)
  const [formUser, setFormUser] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formApiToken, setFormApiToken] = useState('')
  const [formApiUserId, setFormApiUserId] = useState('')
  const [formFromName, setFormFromName] = useState('')
  const [formFromEmail, setFormFromEmail] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const loadProviders = async () => {
    setLoading(true)
    const data = await getEmailProviders()
    setProviders(data as ProviderItem[])
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await getEmailProviders()
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
    setFormType('gmail')
    setFormHost('')
    setFormPort(587)
    setFormSecure(false)
    setFormUser('')
    setFormPassword('')
    setFormApiToken('')
    setFormApiUserId('')
    setFormFromName('')
    setFormFromEmail('')
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

    const result = await saveEmailProvider({
      id: editId ?? undefined,
      name: formName,
      providerType: formType,
      smtpHost: formHost || undefined,
      smtpPort: formPort || undefined,
      smtpSecure: formSecure,
      smtpUser: formUser || undefined,
      smtpPassword: formPassword || undefined,
      apiToken: formApiToken || undefined,
      apiUserId: formApiUserId || undefined,
      fromName: formFromName || undefined,
      fromEmail: formFromEmail || undefined,
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
    if (!confirm('이 이메일 제공자를 삭제하시겠습니까?')) return
    setDeleting(id)
    await deleteEmailProvider(id)
    setDeleting(null)
    await loadProviders()
  }

  const handleTest = async () => {
    if (!testEmail.trim()) {
      setTestResult({ error: '테스트 수신 이메일을 입력하세요' })
      return
    }
    setTesting(true)
    setTestResult(null)
    const result = await testEmailProvider({
      providerType: formType,
      smtpHost: formHost || undefined,
      smtpPort: formPort || undefined,
      smtpSecure: formSecure,
      smtpUser: formUser || undefined,
      smtpPassword: formPassword || undefined,
      apiToken: formApiToken || undefined,
      apiUserId: formApiUserId || undefined,
      fromName: formFromName || undefined,
      fromEmail: formFromEmail || undefined,
      testEmail,
    })
    setTestResult(result)
    setTesting(false)
  }

  const openEditForm = (p: ProviderItem) => {
    setEditId(p.id)
    setFormName(p.name)
    setFormType(p.provider_type)
    setFormHost(p.smtp_host ?? '')
    setFormPort(p.smtp_port ?? 587)
    setFormUser(p.smtp_user ?? '')
    setFormPassword('')
    setFormFromName(p.from_name ?? '')
    setFormFromEmail(p.from_email ?? '')
    setFormIsDefault(p.is_default)
    setFormError(null)
    setTestResult(null)
    setShowForm(true)
  }

  const isSmtpType = formType === 'smtp' || formType === 'gmail' || formType === 'outlook'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings size={18} className="text-stone-600" />
              이메일 제공자 설정
            </CardTitle>
            <CardDescription>이메일 발송에 사용할 서비스를 설정합니다</CardDescription>
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
            등록된 이메일 제공자가 없습니다. 환경변수(HIWORKS) 설정 또는 제공자를 추가하세요.
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
                    {p.smtp_user || p.from_email || '-'}
                    {p.smtp_host && ` · ${p.smtp_host}:${p.smtp_port}`}
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
              <p className="text-sm font-medium text-teal-700">{editId ? '제공자 수정' : '새 제공자 추가'}</p>
              <button onClick={resetForm} className="text-xs text-stone-400 hover:text-stone-600">취소</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">이름</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  placeholder="예: 회사 Gmail"
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
                  <option value="gmail">Gmail SMTP</option>
                  <option value="outlook">Outlook SMTP</option>
                  <option value="smtp">커스텀 SMTP</option>
                  <option value="hiworks">하이웍스 API</option>
                </select>
              </div>
            </div>

            {isSmtpType && (
              <>
                {formType === 'smtp' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-stone-500 mb-1 block">SMTP 호스트</label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                        placeholder="smtp.example.com"
                        value={formHost}
                        onChange={(e) => setFormHost(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">포트</label>
                      <input
                        type="number"
                        className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                        value={formPort}
                        onChange={(e) => setFormPort(Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">
                      {formType === 'gmail' ? 'Gmail 계정' : formType === 'outlook' ? 'Outlook 계정' : 'SMTP 사용자'}
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                      placeholder="user@example.com"
                      value={formUser}
                      onChange={(e) => setFormUser(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">
                      {formType === 'gmail' ? '앱 비밀번호' : '비밀번호'}
                    </label>
                    <input
                      type="password"
                      className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                      placeholder={editId ? '(변경 시에만 입력)' : ''}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                    />
                  </div>
                </div>
                {formType === 'gmail' && (
                  <p className="text-[11px] text-stone-400">
                    Gmail은 앱 비밀번호가 필요합니다. Google 계정 &gt; 보안 &gt; 2단계 인증 &gt; 앱 비밀번호에서 생성하세요.
                  </p>
                )}
              </>
            )}

            {formType === 'hiworks' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">Office Token</label>
                  <input
                    type="password"
                    className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                    placeholder={editId ? '(변경 시에만 입력)' : ''}
                    value={formApiToken}
                    onChange={(e) => setFormApiToken(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">User ID</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                    value={formApiUserId}
                    onChange={(e) => setFormApiUserId(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">발신자 이름 (선택)</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  placeholder="예: CS교육팀"
                  value={formFromName}
                  onChange={(e) => setFormFromName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">발신자 이메일 (선택)</label>
                <input
                  type="email"
                  className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  placeholder="기본: SMTP 계정과 동일"
                  value={formFromEmail}
                  onChange={(e) => setFormFromEmail(e.target.value)}
                />
              </div>
            </div>

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
                type="email"
                className="flex-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm"
                placeholder="테스트 수신 이메일"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 size={13} className="mr-1 animate-spin" /> : <TestTube size={13} className="mr-1" />}
                테스트
              </Button>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                {testResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {testResult.success ? '테스트 메일 발송 성공' : testResult.error}
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
