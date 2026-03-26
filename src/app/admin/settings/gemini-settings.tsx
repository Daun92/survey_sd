'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Key, CheckCircle, ExternalLink } from 'lucide-react'

export function GeminiSettings() {
  const [apiKey, setApiKey] = useState('')
  const [maskedKey, setMaskedKey] = useState('')
  const [isSet, setIsSet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.gemini_api_key_set === 'true') {
          setIsSet(true)
          setMaskedKey(data.gemini_api_key || '')
        }
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'gemini_api_key', value: apiKey.trim() }),
      })

      if (res.ok) {
        setIsSet(true)
        setMaskedKey(apiKey.slice(0, 6) + '...' + apiKey.slice(-4))
        setApiKey('')
        setMessage({ type: 'success', text: 'API 키가 저장되었습니다' })
      } else {
        setMessage({ type: 'error', text: '저장에 실패했습니다' })
      }
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/ai/report-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: 'API 연결 테스트',
          sessionName: '테스트',
          overallAvg: 4.2,
          responseRate: 80,
          totalResponses: 30,
          sectionScores: [{ name: '교육내용', avg: 4.3 }],
          questionScores: [{ code: 'Q1', text: '테스트 문항', section: '교육내용', avg: 4.3 }],
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Gemini API 연결 정상!' })
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '연결 실패' })
      }
    } catch {
      setMessage({ type: 'error', text: 'API 호출 실패' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="lg:col-span-2 border-amber-200 bg-amber-50/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Key size={16} className="text-amber-600" />
              AI 설정 (Gemini API)
            </CardTitle>
            <CardDescription className="mt-1">
              AI 문항 생성, 응답 요약, 리포트 코멘트 자동생성 기능을 사용하려면 Gemini API 키를 입력하세요
            </CardDescription>
          </div>
          {isSet && <Badge variant="success">연결됨</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 현재 상태 */}
          {isSet && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={14} className="text-green-600" />
              <span className="text-stone-600">현재 키: </span>
              <code className="bg-white/80 px-2 py-0.5 rounded text-xs font-mono">{maskedKey}</code>
            </div>
          )}

          {/* 키 입력 */}
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder={isSet ? '새 API 키로 변경하려면 입력하세요' : 'Gemini API 키를 입력하세요'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-white"
            />
            <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : '저장'}
            </Button>
            {isSet && (
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 size={14} className="animate-spin" /> : '연결 테스트'}
              </Button>
            )}
          </div>

          {/* 안내 */}
          <div className="text-xs text-stone-500 space-y-1">
            <p>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 hover:underline inline-flex items-center gap-1"
              >
                Google AI Studio <ExternalLink size={10} />
              </a>
              에서 API 키를 무료로 발급받을 수 있습니다.
            </p>
            <p>API 키는 서버에만 저장되며, 클라이언트에 노출되지 않습니다.</p>
          </div>

          {/* 메시지 */}
          {message && (
            <div
              className={`text-sm px-3 py-2 rounded ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
