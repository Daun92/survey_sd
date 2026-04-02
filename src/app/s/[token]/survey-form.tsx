'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2, ChevronRight, ChevronLeft, Clock, FileText, Shield } from 'lucide-react'
import { parseSimpleMarkdown } from '@/lib/simple-markdown'

interface SkipLogicCondition {
  show_when: {
    question_id: string
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than'
    value: string | number
  }
}

interface SurveyQuestion {
  id: string
  code: string
  text: string
  type: string
  required: boolean
  options?: string[] | null
  skip_logic?: SkipLogicCondition | null
  metadata?: Record<string, unknown> | null
}

interface SurveySection {
  name: string
  questions: SurveyQuestion[]
}

interface RespondentFieldConfig {
  id: string
  label: string
  enabled: boolean
  required: boolean
}

interface SurveyData {
  id: string
  title: string
  description: string
  status: string
  token: string
  settings: {
    anonymous?: boolean
    collect_respondent_info?: boolean
    show_progress?: boolean
    thank_you_message?: string
    landing_notice?: string
    ending_title?: string
    welcome_message?: string
    privacy_consent_text?: string
    require_consent?: boolean
    hero_image_url?: string
    show_meta_info?: boolean
    show_ending_stats?: boolean
    respondent_fields?: RespondentFieldConfig[]
    section_intros?: Record<string, {
      title?: string
      description?: string
      color?: string
      image_url?: string
      image_size?: string
    }>
  }
  sessionName: string
  sections: SurveySection[]
}

const DEFAULT_RESPONDENT_FIELDS: RespondentFieldConfig[] = [
  { id: 'name', label: '이름', enabled: true, required: false },
  { id: 'department', label: '소속', enabled: true, required: false },
]

type Step = 'landing' | 'questions' | 'ending'

const INTRO_STYLE_MAP: Record<string, { bg: string; border: string; borderLeft: string; color: string; bar: string }> = {
  neutral:     { bg: '#fafaf9',  border: '#e7e5e4', borderLeft: '#a8a29e', color: '#44403c', bar: '#a8a29e' },
  brand:       { bg: '#f0fdfa',  border: '#ccfbf1', borderLeft: '#14b8a6', color: '#0d9488', bar: '#14b8a6' },
  warm:        { bg: '#faf5f0',  border: '#e8ddd0', borderLeft: '#d97706', color: '#92400e', bar: '#d97706' },
  cool:        { bg: '#f0f5fa',  border: '#d0dde8', borderLeft: '#3b82f6', color: '#1e40af', bar: '#3b82f6' },
  rose:        { bg: '#fff1f2',  border: '#fecdd3', borderLeft: '#f43f5e', color: '#9f1239', bar: '#f43f5e' },
  violet:      { bg: '#f5f3ff',  border: '#ddd6fe', borderLeft: '#8b5cf6', color: '#5b21b6', bar: '#8b5cf6' },
  green:       { bg: '#f0fdf4',  border: '#bbf7d0', borderLeft: '#22c55e', color: '#166534', bar: '#22c55e' },
  transparent: { bg: 'transparent', border: 'transparent', borderLeft: 'transparent', color: '#1c1917', bar: 'transparent' },
  // 하위 호환: 이전 색상명도 지원
  teal:        { bg: '#f0fdfa',  border: '#ccfbf1', borderLeft: '#14b8a6', color: '#0d9488', bar: '#14b8a6' },
  blue:        { bg: '#f0f5fa',  border: '#d0dde8', borderLeft: '#3b82f6', color: '#1e40af', bar: '#3b82f6' },
  amber:       { bg: '#faf5f0',  border: '#e8ddd0', borderLeft: '#d97706', color: '#92400e', bar: '#d97706' },
}

const LIKERT_PRESETS: Record<string, Record<number, string>> = {
  satisfaction: { 5: '매우 만족', 4: '만족', 3: '보통', 2: '불만족', 1: '매우 불만족' },
  agreement: { 5: '매우 그렇다', 4: '그렇다', 3: '보통', 2: '그렇지 않다', 1: '전혀 그렇지 않다' },
  agree_disagree: { 5: '매우 동의', 4: '동의', 3: '보통', 2: '비동의', 1: '전혀 동의하지 않음' },
  frequency: { 5: '매우 자주', 4: '자주', 3: '보통', 2: '드물게', 1: '전혀 없음' },
  importance: { 5: '매우 중요', 4: '중요', 3: '보통', 2: '중요하지 않음', 1: '전혀 중요하지 않음' },
}
const getLikertLabelsForQuestion = (q: SurveyQuestion): Record<number, string> => {
  const presetId = (q.metadata?.likert_label_preset as string) || 'satisfaction'
  return LIKERT_PRESETS[presetId] || LIKERT_PRESETS.satisfaction
}

function shouldShowQuestion(q: SurveyQuestion, answers: Record<string, number | string | number[]>): boolean {
  if (!q.skip_logic?.show_when) return true
  const { question_id, operator, value } = q.skip_logic.show_when
  const answer = answers[question_id]
  if (answer === undefined) return false
  switch (operator) {
    case 'equals': return String(answer) === String(value)
    case 'not_equals': return String(answer) !== String(value)
    case 'greater_than': return Number(answer) > Number(value)
    case 'less_than': return Number(answer) < Number(value)
    default: return true
  }
}

function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-200 md:flex md:items-center md:justify-center md:py-8">
      <div className="w-full md:w-[420px] md:min-h-[720px] md:max-h-[90vh] md:rounded-3xl md:shadow-2xl md:border md:border-stone-300 md:overflow-hidden bg-stone-50 flex flex-col min-h-screen md:min-h-0 md:relative">
        {children}
      </div>
    </div>
  )
}

interface PrefillRespondent {
  name?: string
  department?: string
  position?: string
}

export default function SurveyForm({ survey, groupToken, distributionToken, prefillRespondent }: {
  survey: SurveyData
  groupToken: string | null
  distributionToken?: string
  prefillRespondent?: PrefillRespondent
}) {
  // ─── sessionStorage 키 (설문별 고유) ───
  const storageKey = `survey_draft_${survey.id}`

  const loadDraft = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return null
      return JSON.parse(raw) as {
        answers: Record<string, number | string | number[]>
        respondentInfo: Record<string, string>
        sectionIdx: number
        step: Step
      }
    } catch { return null }
  }, [storageKey])

  const [step, setStep] = useState<Step>(() => {
    if (typeof window === 'undefined') return 'landing'
    const draft = (() => { try { const r = sessionStorage.getItem(`survey_draft_${survey.id}`); return r ? JSON.parse(r) : null } catch { return null } })()
    return draft?.step ?? 'landing'
  })
  const [answers, setAnswers] = useState<Record<string, number | string | number[]>>(() => {
    if (typeof window === 'undefined') return {}
    const draft = (() => { try { const r = sessionStorage.getItem(`survey_draft_${survey.id}`); return r ? JSON.parse(r) : null } catch { return null } })()
    return draft?.answers ?? {}
  })
  const [respondentInfo, setRespondentInfo] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const draft = (() => { try { const r = sessionStorage.getItem(`survey_draft_${survey.id}`); return r ? JSON.parse(r) : null } catch { return null } })()
      if (draft?.respondentInfo && Object.keys(draft.respondentInfo).length > 0) return draft.respondentInfo
    }
    const initial: Record<string, string> = {}
    if (prefillRespondent?.name) initial.name = prefillRespondent.name
    if (prefillRespondent?.department) initial.department = prefillRespondent.department
    if (prefillRespondent?.position) initial.position = prefillRespondent.position
    return initial
  })
  const [consentChecked, setConsentChecked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startTimeRef = useRef<number>(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [elapsedTime, setElapsedTime] = useState('')
  const [currentSectionIdx, setCurrentSectionIdx] = useState(() => {
    if (typeof window === 'undefined') return 0
    const draft = (() => { try { const r = sessionStorage.getItem(`survey_draft_${survey.id}`); return r ? JSON.parse(r) : null } catch { return null } })()
    return draft?.sectionIdx ?? 0
  })
  const [toast, setToast] = useState<string | null>(null)

  // ─── 응답 상태를 sessionStorage에 자동 저장 ───
  useEffect(() => {
    if (step === 'ending') {
      sessionStorage.removeItem(storageKey)
      return
    }
    const hasAnswers = Object.keys(answers).length > 0
    if (!hasAnswers && step === 'landing') return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        answers, respondentInfo, sectionIdx: currentSectionIdx, step,
      }))
    } catch { /* storage full — 무시 */ }
  }, [answers, respondentInfo, currentSectionIdx, step, storageKey])

  // ─── 이탈 경고 (beforeunload) ───
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (step === 'ending' || Object.keys(answers).length === 0) return
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [step, answers])

  const respondentFields: RespondentFieldConfig[] =
    survey.settings.respondent_fields?.filter((f) => f.enabled) ?? DEFAULT_RESPONDENT_FIELDS

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
    // Safari 및 모바일 브라우저 호환
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  // draft에서 questions 단계로 복원된 경우 startTime 설정
  useEffect(() => {
    if (step === 'questions' && startTimeRef.current === 0) {
      startTimeRef.current = Date.now()
    }
  }, [step])

  const allQuestions = survey.sections.flatMap((s) => s.questions)
  const isLikertType = (t: string) => t === 'likert_5' || t === 'likert_6'
  const totalLikert = allQuestions.filter((q) => isLikertType(q.type)).length
  const answeredLikert = Object.entries(answers).filter(([, v]) => typeof v === 'number').length
  const progress = totalLikert > 0 ? Math.round((answeredLikert / totalLikert) * 100) : 0
  const requiredLikert = allQuestions.filter((q) => isLikertType(q.type) && q.required)
  const allRequiredAnswered = requiredLikert.every((q) => answers[q.id] !== undefined)
  const estimatedMinutes = Math.max(1, Math.ceil(allQuestions.length * 0.4))

  const handleLikertChange = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleMultipleChoiceToggle = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => {
      const current = prev[questionId]
      const arr = Array.isArray(current) ? [...current] : []
      const idx = arr.indexOf(optionIndex)
      if (idx >= 0) {
        arr.splice(idx, 1)
      } else {
        arr.push(optionIndex)
      }
      return { ...prev, [questionId]: arr }
    })
  }

  const getSectionIntro = (sectionIdx: number) => {
    const sectionName = survey.sections[sectionIdx]?.name
    if (!sectionName || !survey.settings.section_intros) return null
    const intro = survey.settings.section_intros[sectionName]
    if (!intro?.title && !intro?.description && !intro?.image_url) return null
    return intro
  }

  const handleStart = () => {
    startTimeRef.current = Date.now()
    setStep('questions')
    scrollToTop()
    // distribution 상태를 started로 업데이트
    if (distributionToken) {
      fetch(`/api/distributions/${distributionToken}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'started' }),
      }).catch(() => {}) // 실패해도 설문 진행에 영향 없음
    }
  }

  const handleSubmit = async () => {
    if (!validateCurrentSection()) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/surveys/${survey.token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.fromEntries(
            Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v])
          ),
          respondent_name: prefillRespondent?.name || respondentInfo.name || null,
          respondent_department: respondentInfo.department || null,
          respondent_position: respondentInfo.position || null,
          respondent_info: respondentInfo,
          class_group_id: groupToken || null,
          distribution_token: distributionToken || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '제출에 실패했습니다')
        return
      }

      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
      const minutes = Math.floor(elapsed / 60)
      const seconds = elapsed % 60
      setElapsedTime(minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`)
      setStep('ending')
      scrollToTop()
    } catch (err) {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Landing Page ───
  if (step === 'landing') {
    const hasConsent = !!survey.settings.privacy_consent_text
    const needsConsent = hasConsent && survey.settings.require_consent
    const requiredFieldsFilled = survey.settings.collect_respondent_info !== false
      ? respondentFields.filter((f) => f.required).every((f) => (respondentInfo[f.id] ?? '').trim() !== '')
      : true
    const canStart = (!needsConsent || consentChecked) && requiredFieldsFilled

    return (
      <MobileFrame>
      <div className="flex-1 flex flex-col bg-stone-50 overflow-y-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-stone-100">
          <Image src="/logo_exc.png" alt="EXPERT" width={100} height={20} className="h-5 w-auto" />
          <span className="text-[11px] text-stone-400 tracking-wide">Satisfaction Survey</span>
        </div>

        {/* Hero Banner Image */}
        {survey.settings.hero_image_url && (
          <div className="w-full h-36 overflow-hidden">
            <img src={survey.settings.hero_image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Center-aligned content area */}
        <div className="flex-1 flex flex-col justify-center">

        {/* Survey Title (표기용 제목만 표시, sessionName은 내부 관리용이므로 미표시) */}
        <div className="flex flex-col items-center pt-8 pb-2 px-6">
          <h1 className="text-[20px] font-bold text-stone-900 text-center leading-tight tracking-tight">
            {String(survey.title ?? '')}
          </h1>
        </div>

        {/* Welcome Message */}
        <div className="px-6 pb-2">
          {survey.settings.welcome_message ? (
            <p className="text-[14px] text-stone-600 leading-relaxed whitespace-pre-line text-center">
              {survey.settings.welcome_message}
            </p>
          ) : (
            <p className="text-[14px] text-stone-600 leading-relaxed text-center">
              안녕하세요, 고객님.<br />
              귀하의 소중한 의견은 더 나은 교육 서비스를<br />
              제공하는 데 큰 도움이 됩니다.
            </p>
          )}
          <div className="w-10 h-px bg-stone-200 mx-auto mt-5" />
        </div>

        {/* Content */}
        <div className="px-6 space-y-4">
          {/* Description */}
          {survey.description && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-[12px] font-semibold text-stone-700 mb-1">안내사항</p>
              <p className="text-[13px] text-stone-500 leading-relaxed">{String(survey.description ?? '')}</p>
            </div>
          )}

          {/* Meta Info */}
          {survey.settings.show_meta_info !== false && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center gap-1 py-3 bg-white border border-stone-200 rounded-xl flex-1">
                <Clock size={16} className="text-teal-600" />
                <span className="text-base font-bold text-stone-800">{estimatedMinutes}분</span>
                <span className="text-[10px] text-stone-400">예상 소요</span>
              </div>
              <div className="flex flex-col items-center gap-1 py-3 bg-white border border-stone-200 rounded-xl flex-1">
                <FileText size={16} className="text-teal-600" />
                <span className="text-base font-bold text-stone-800">{allQuestions.length}문항</span>
                <span className="text-[10px] text-stone-400">전체 문항</span>
              </div>
            </div>
          )}

          {/* Dynamic Respondent Fields */}
          {survey.settings.collect_respondent_info !== false && respondentFields.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-widest">응답자 정보</p>
              <div className={`grid gap-2 ${respondentFields.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {respondentFields.map((field) => {
                  const isPrefilled = !!prefillRespondent && !!(prefillRespondent as any)[field.id]
                  return (
                    <Input
                      key={field.id}
                      placeholder={`${field.label}${field.required ? ' *' : ''}`}
                      type={field.id === 'email' ? 'email' : field.id === 'phone' ? 'tel' : 'text'}
                      value={respondentInfo[field.id] || ''}
                      onChange={(e) => setRespondentInfo(prev => ({ ...prev, [field.id]: e.target.value }))}
                      readOnly={isPrefilled}
                      className={`h-10 w-full rounded-xl text-sm ${isPrefilled ? 'bg-stone-100 text-stone-500' : 'bg-white border-stone-300'}`}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Privacy Consent Card */}
          {hasConsent && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <Shield size={14} className="text-teal-600 mt-0.5 shrink-0" />
                <p className="text-[12px] font-semibold text-stone-700">개인정보 수집 안내</p>
              </div>
              <p className="text-[12px] text-stone-500 leading-relaxed whitespace-pre-line">
                {survey.settings.privacy_consent_text}
              </p>
              {survey.settings.require_consent && (
                <label className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="accent-teal-600 w-4 h-4"
                  />
                  <span className="text-[12px] font-medium text-stone-700">위 내용에 동의합니다</span>
                </label>
              )}
            </div>
          )}
        </div>

        </div>{/* end center-aligned content */}

        {/* CTA */}
        <div className="px-6 pb-6 pt-5">
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full h-[52px] bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            설문 시작하기
            <ChevronRight size={18} />
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <Shield size={11} className="text-stone-300" />
            <span className="text-[10px] text-stone-400">{survey.settings.landing_notice || '모든 응답은 익명으로 안전하게 처리됩니다'}</span>
          </div>
        </div>
      </div>
      </MobileFrame>
    )
  }

  // ─── Ending Page ───
  if (step === 'ending') {
    return (
      <MobileFrame>
      <div className="flex-1 flex flex-col items-center justify-center px-6 bg-stone-50 relative">
        <div className="flex flex-col items-center gap-6 -mt-16">
          <div className="flex items-center justify-center w-[72px] h-[72px] bg-teal-50 rounded-full border-2 border-teal-100">
            <CheckCircle2 className="w-8 h-8 text-teal-600" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-[22px] font-bold text-stone-900">{survey.settings.ending_title || '응답이 제출되었습니다'}</h2>
            <p className="text-sm text-stone-500 leading-relaxed whitespace-pre-line">
              {survey.settings.thank_you_message || '소중한 의견에 감사드립니다.\n응답 내용은 서비스 품질 개선에 활용됩니다.'}
            </p>
          </div>
          {survey.settings.show_ending_stats !== false && (
          <div className="flex items-center gap-6 pt-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold text-stone-800">{answeredLikert + Object.entries(answers).filter(([, v]) => (typeof v === 'string' && v.length > 0) || (Array.isArray(v) && v.length > 0)).length}</span>
              <span className="text-[11px] text-stone-400">응답 문항</span>
            </div>
            <div className="w-px h-10 bg-stone-200" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold text-stone-800">{elapsedTime}</span>
              <span className="text-[11px] text-stone-400">소요 시간</span>
            </div>
          </div>
          )}
        </div>
        <div className="absolute bottom-8 flex flex-col items-center gap-2">
          <Image src="/logo_exc.png" alt="EXPERT" width={80} height={16} className="h-4 w-auto opacity-30" />
          <span className="text-[11px] text-stone-300">Powered by EXC-Survey</span>
        </div>
      </div>
      </MobileFrame>
    )
  }

  const totalSections = survey.sections.length
  const currentSection = survey.sections[Math.min(currentSectionIdx, totalSections - 1)]

  const handleLikertChangeWithScroll = (questionId: string, value: number) => {
    handleLikertChange(questionId, value)
    // Auto-scroll to next VISIBLE question (skip_logic 반영)
    const currentQuestions = currentSection?.questions ?? []
    const idx = currentQuestions.findIndex((q) => q.id === questionId)
    if (idx >= 0) {
      const nextAnswers = { ...answers, [questionId]: value }
      const nextVisible = currentQuestions.slice(idx + 1).find((q) => shouldShowQuestion(q, nextAnswers))
      if (nextVisible) {
        setTimeout(() => {
          document.getElementById(`q-${nextVisible.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)
      }
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const validateCurrentSection = (): boolean => {
    if (!currentSection) return true
    const visibleQuestions = currentSection.questions.filter((q) => shouldShowQuestion(q, answers))
    const unanswered = visibleQuestions.find((q) => {
      if (!q.required) return false
      const val = answers[q.id]
      if (val === undefined) return true
      if (Array.isArray(val) && val.length === 0) return true
      return false
    })
    if (unanswered) {
      showToast(`"${String(unanswered.text).slice(0, 30)}..." 문항에 응답해 주세요`)
      setTimeout(() => {
        const el = document.getElementById(`q-${unanswered.id}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-2', 'ring-rose-400', 'ring-offset-2', 'rounded-xl')
          setTimeout(() => el.classList.remove('ring-2', 'ring-rose-400', 'ring-offset-2', 'rounded-xl'), 2000)
        }
      }, 100)
      return false
    }
    return true
  }

  const handleNextSection = () => {
    if (!validateCurrentSection()) return
    if (currentSectionIdx < totalSections - 1) {
      setCurrentSectionIdx(currentSectionIdx + 1)
      scrollToTop()
    }
  }

  const handlePrevSection = () => {
    if (currentSectionIdx > 0) {
      setCurrentSectionIdx(currentSectionIdx - 1)
      scrollToTop()
    } else {
      setStep('landing')
    }
  }

  const isLastSection = currentSectionIdx >= totalSections - 1

  // ─── Questions Page ───
  return (
    <MobileFrame>
    <div ref={scrollContainerRef} className="flex-1 flex flex-col bg-stone-50 overflow-y-auto">
      {/* Header with progress */}
      <div className="bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3.5">
          <button
            onClick={handlePrevSection}
            className="flex items-center gap-1 text-stone-500 hover:text-stone-700 transition-colors"
          >
            <ChevronLeft size={18} />
            <span className="text-[15px] font-semibold text-stone-800">{survey.title}</span>
          </button>
          <span className="text-[13px] font-medium text-teal-600">{currentSectionIdx + 1}/{totalSections}</span>
        </div>
        <div className="h-[3px] bg-stone-100">
          <div
            className="h-full bg-teal-500 transition-all duration-300 rounded-r-full"
            style={{ width: `${totalSections > 1 ? ((currentSectionIdx + 1) / totalSections) * 100 : progress}%` }}
          />
        </div>
        {/* Section header */}
        {totalSections > 1 && currentSection && (
          <div className="px-6 py-2.5 border-b border-stone-100 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-teal-600">{currentSectionIdx + 1}/{totalSections}</span>
              <span className="text-[15px] font-semibold text-stone-800">{String(currentSection.name ?? '')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Inline Section Banner */}
      {(() => {
        const intro = getSectionIntro(currentSectionIdx)
        // 디버깅: intro가 없어도 섹션 이름으로 안내 표시
        const sectionName = survey.sections[currentSectionIdx]?.name
        if (!intro && !sectionName) return null

        if (!intro) {
          // section_intros 미설정 시 기본 섹션 헤더 배너
          return null
        }

        const colors = INTRO_STYLE_MAP[intro.color || 'brand'] || INTRO_STYLE_MAP.brand
        const isTransparent = intro.color === 'transparent'
        const size = intro.image_size || 'original'
        return (
          <div
            data-testid="section-banner"
            className="mx-6 mt-4 mb-2"
            style={{
              backgroundColor: colors.bg,
              border: isTransparent ? 'none' : `1px solid ${colors.border}`,
              borderLeft: isTransparent ? 'none' : `4px solid ${colors.bar}`,
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: isTransparent ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {/* full 크기: 배너 상단 full-bleed (padding 없이 가득) */}
            {intro.image_url && size === 'full' && (
              <img
                src={intro.image_url}
                alt=""
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            )}
            {/* 텍스트 + non-full 이미지 영역 */}
            {(intro.title || intro.description || (intro.image_url && size !== 'full')) && (
              <div style={{ padding: '14px 16px' }}>
                {/* full 이외 크기: 패딩 안에서 실제 이미지 크기 반영 */}
                {intro.image_url && size !== 'full' && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                    <img
                      src={intro.image_url}
                      alt=""
                      style={{
                        display: 'block',
                        height: 'auto',
                        ...(size === 'small'
                          ? { width: '38%' }
                          : size === 'medium'
                          ? { width: '58%' }
                          : { width: 'auto', maxWidth: '100%' }),
                      }}
                    />
                  </div>
                )}
                {intro.title && (
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: colors.color,
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {intro.title}
                  </p>
                )}
                {intro.description && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#57534e',
                      marginTop: intro.title ? '4px' : 0,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {intro.description}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Questions — current section only */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-6 space-y-6">
        {(() => {
          let visibleIdx = 0
          return currentSection && currentSection.questions.map((question) => {
            if (!shouldShowQuestion(question, answers)) return null

            // 안내 블록 렌더링
            if (question.type === 'info_block') {
              const style = (question.metadata?.block_style as string) || 'info'
              if (style === 'divider') {
                return (
                  <div key={question.id} id={`q-${question.id}`} className="py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-stone-200" />
                      {question.text && <span className="text-xs text-stone-400 shrink-0">{String(question.text)}</span>}
                      <div className="flex-1 h-px bg-stone-200" />
                    </div>
                  </div>
                )
              }
              const blockMap: Record<string, { colors: string; icon: string; iconColor: string }> = {
                info: { colors: 'bg-blue-50 border-blue-200 text-blue-800', icon: 'ℹ', iconColor: 'text-blue-500' },
                warning: { colors: 'bg-amber-50 border-amber-200 text-amber-800', icon: '⚠', iconColor: 'text-amber-500' },
                success: { colors: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: '✓', iconColor: 'text-emerald-500' },
                tip: { colors: 'bg-violet-50 border-violet-200 text-violet-800', icon: '💡', iconColor: 'text-violet-500' },
              }
              const b = blockMap[style] || blockMap.info
              return (
                <div key={question.id} id={`q-${question.id}`} className={`rounded-xl border px-4 py-3 ${b.colors}`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 shrink-0 ${b.iconColor}`}>
                      {b.icon}
                    </span>
                    <div className="text-sm leading-relaxed">{parseSimpleMarkdown(String(question.text ?? ''))}</div>
                  </div>
                </div>
              )
            }

            visibleIdx++
            return (
            <div key={question.id} id={`q-${question.id}`} className="space-y-3">
              <p className="text-[15px] text-stone-800 leading-relaxed">
                <span className="text-[13px] font-semibold text-teal-600 mr-2">
                  {String(visibleIdx).padStart(2, '0')}
                </span>
              {String(question.text ?? '')}
              {question.required === true && <span className="text-rose-400 ml-1">*</span>}
            </p>

            {(question.type === 'likert_5' || question.type === 'likert_6') && (() => {
              const qLabels = getLikertLabelsForQuestion(question)
              const points = [5, 4, 3, 2, 1]
              return (
                <div className="space-y-1">
                  <div className="flex gap-1.5">
                    {points.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleLikertChangeWithScroll(question.id, value)}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium border-[1.5px] transition-all ${
                          answers[question.id] === value
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-white text-stone-500 border-stone-200 hover:border-teal-300 hover:bg-teal-50'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {points.map((value) => (
                      <span key={value} className="flex-1 text-center text-[10px] text-stone-400 leading-tight">
                        {value === 5 || value === 3 || value === 1 ? qLabels[value] : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}

            {question.type === 'single_choice' && question.options && (
              <div className="space-y-1.5">
                {question.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleLikertChangeWithScroll(question.id, i + 1)}
                    className={`w-full min-h-[44px] flex items-center px-4 rounded-xl border-[1.5px] text-sm text-left transition-all ${
                      answers[question.id] === i + 1
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-teal-300 hover:bg-teal-50'
                    }`}
                  >
                    {String(opt)}
                  </button>
                ))}
              </div>
            )}

            {question.type === 'multiple_choice' && question.options && (() => {
              const selected = Array.isArray(answers[question.id]) ? (answers[question.id] as number[]) : []
              return (
                <div className="space-y-1.5">
                  {question.options.map((opt, i) => {
                    const optIdx = i + 1
                    const isSelected = selected.includes(optIdx)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleMultipleChoiceToggle(question.id, optIdx)}
                        className={`w-full min-h-[44px] flex items-center gap-3 px-4 rounded-xl border-[1.5px] text-sm text-left transition-all ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-teal-300 hover:bg-teal-50'
                        }`}
                      >
                        <span className={`flex-shrink-0 w-4.5 h-4.5 rounded border-[1.5px] flex items-center justify-center text-[10px] ${
                          isSelected ? 'bg-white/20 border-white/40' : 'border-stone-300'
                        }`}>
                          {isSelected && '✓'}
                        </span>
                        {String(opt)}
                      </button>
                    )
                  })}
                  {selected.length > 0 && (
                    <p className="text-xs text-teal-600 pl-1">{selected.length}개 선택됨 (복수 선택 가능)</p>
                  )}
                  {selected.length === 0 && (
                    <p className="text-xs text-stone-400 pl-1">복수 선택 가능</p>
                  )}
                </div>
              )
            })()}

            {question.type === 'text' && (
              <Textarea
                placeholder="의견을 입력해 주세요..."
                rows={3}
                className="rounded-xl bg-white border-stone-300 shadow-sm"
                value={(answers[question.id] as string) || ''}
                onChange={(e) => handleTextChange(question.id, e.target.value)}
              />
            )}

            {question.type === 'yes_no' && (
              <div className="flex gap-2">
                {[{ value: 1, label: '예' }, { value: 2, label: '아니오' }].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleLikertChangeWithScroll(question.id, value)}
                    className={`flex-1 h-12 rounded-xl text-sm font-medium border-[1.5px] transition-all ${
                      answers[question.id] === value
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-stone-500 border-stone-200 hover:border-teal-300 hover:bg-teal-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="h-px bg-stone-100" />
          </div>
          )
        })
        })()}
      </div>

      {/* Toast — fixed top, highest z-index */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2 shadow-lg">
          <span className="text-amber-500 shrink-0">⚠</span>
          {toast}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-6 mb-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Bottom Nav — section-aware */}
      <div className="bg-white border-t border-stone-100 sticky bottom-0">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between px-6 py-4">
          <button
            onClick={handlePrevSection}
            className="flex items-center gap-1 text-stone-500 hover:text-stone-700 transition-colors"
          >
            <ChevronLeft size={16} />
            <span className="text-sm font-medium">이전</span>
          </button>
          <span className="text-xs text-stone-400">
            {totalSections > 1 ? `${currentSectionIdx + 1}/${totalSections} 섹션` : `${answeredLikert}/${totalLikert} 응답 완료`}
          </span>
          {isLastSection ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 h-10 px-5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors"
            >
              {isSubmitting ? (
                <><Loader2 size={16} className="animate-spin" />제출 중</>
              ) : (
                <>제출하기<ChevronRight size={16} /></>
              )}
            </button>
          ) : (
            <button
              onClick={handleNextSection}
              className="flex items-center gap-1.5 h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              다음<ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
    </MobileFrame>
  )
}
