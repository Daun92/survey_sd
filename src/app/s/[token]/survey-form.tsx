'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2, ChevronRight, ChevronLeft, Clock, FileText, Shield } from 'lucide-react'

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
    respondent_fields?: RespondentFieldConfig[]
  }
  sessionName: string
  sections: SurveySection[]
}

const DEFAULT_RESPONDENT_FIELDS: RespondentFieldConfig[] = [
  { id: 'name', label: '이름', enabled: true, required: false },
  { id: 'department', label: '소속', enabled: true, required: false },
]

type Step = 'landing' | 'questions' | 'ending'

const likertLabels: Record<number, string> = { 5: '매우 만족', 4: '만족', 3: '보통', 2: '불만족', 1: '매우 불만족' }

function shouldShowQuestion(q: SurveyQuestion, answers: Record<string, number | string>): boolean {
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

export default function SurveyForm({ survey, groupToken }: { survey: SurveyData; groupToken: string | null }) {
  const [step, setStep] = useState<Step>('landing')
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [respondentInfo, setRespondentInfo] = useState<Record<string, string>>({})
  const [consentChecked, setConsentChecked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startTimeRef = useRef<number>(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [elapsedTime, setElapsedTime] = useState('')
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)

  const respondentFields: RespondentFieldConfig[] =
    survey.settings.respondent_fields?.filter((f) => f.enabled) ?? DEFAULT_RESPONDENT_FIELDS

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  const handleStart = () => {
    startTimeRef.current = Date.now()
    setStep('questions')
    scrollToTop()
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/surveys/${survey.token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          respondent_name: respondentInfo.name || null,
          respondent_department: respondentInfo.department || null,
          respondent_position: respondentInfo.position || null,
          respondent_info: respondentInfo,
          class_group_id: groupToken || null,
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
    const canStart = !needsConsent || consentChecked

    return (
      <MobileFrame>
      <div className="flex-1 flex flex-col bg-stone-50 overflow-y-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-stone-100">
          <Image src="/logo-expert.svg" alt="EXPERT" width={100} height={20} className="h-5 w-auto" />
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

        {/* Welcome Message */}
        <div className="px-6 pt-8 pb-2">
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
        </div>

        {/* Survey Title */}
        <div className="flex flex-col items-center py-5 px-6">
          <div className="w-10 h-px bg-stone-200 mb-5" />
          <h1 className="text-[20px] font-bold text-stone-900 text-center leading-tight tracking-tight">
            {String(survey.title ?? '')}
          </h1>
          {survey.sessionName && (
            <p className="text-[13px] text-stone-500 mt-1.5">{String(survey.sessionName ?? '')}</p>
          )}
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
              <div className="grid grid-cols-2 gap-2">
                {respondentFields.map((field) => (
                  <Input
                    key={field.id}
                    placeholder={`${field.label}${field.required ? ' *' : ''}`}
                    type={field.id === 'email' ? 'email' : field.id === 'phone' ? 'tel' : 'text'}
                    value={respondentInfo[field.id] || ''}
                    onChange={(e) => setRespondentInfo(prev => ({ ...prev, [field.id]: e.target.value }))}
                    className="h-10 rounded-xl text-sm"
                  />
                ))}
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
          <div className="flex items-center gap-6 pt-2">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold text-stone-800">{answeredLikert + Object.entries(answers).filter(([, v]) => typeof v === 'string' && v.length > 0).length}</span>
              <span className="text-[11px] text-stone-400">응답 문항</span>
            </div>
            <div className="w-px h-10 bg-stone-200" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold text-stone-800">{elapsedTime}</span>
              <span className="text-[11px] text-stone-400">소요 시간</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 flex flex-col items-center gap-2">
          <Image src="/logo-expert.svg" alt="EXPERT" width={80} height={16} className="h-4 w-auto opacity-30" />
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
    // Auto-scroll to next question
    const currentQuestions = currentSection?.questions ?? []
    const idx = currentQuestions.findIndex((q) => q.id === questionId)
    if (idx >= 0 && idx < currentQuestions.length - 1) {
      const nextId = currentQuestions[idx + 1].id
      setTimeout(() => {
        document.getElementById(`q-${nextId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    }
  }

  const handleNextSection = () => {
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
          <span className="text-[13px] font-medium text-teal-600">{answeredLikert}/{totalLikert}</span>
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

      {/* Questions — current section only */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-6 space-y-6">
        {currentSection && currentSection.questions.map((question, qIdx) => {
          if (!shouldShowQuestion(question, answers)) return null
          return (
          <div key={question.id} id={`q-${question.id}`} className="space-y-3">
            <p className="text-[15px] text-stone-800 leading-relaxed">
              <span className="text-[13px] font-semibold text-teal-600 mr-2">
                {String(qIdx + 1).padStart(2, '0')}
              </span>
              {String(question.text ?? '')}
              {question.required === true && <span className="text-rose-400 ml-1">*</span>}
            </p>

            {(question.type === 'likert_5' || question.type === 'likert_6') && (
              <div className="flex gap-1.5">
                {[5, 4, 3, 2, 1].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleLikertChangeWithScroll(question.id, value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-sm font-medium border-[1.5px] transition-all ${
                      answers[question.id] === value
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-stone-500 border-stone-200 hover:border-teal-300 hover:bg-teal-50'
                    }`}
                  >
                    <span className="text-[16px]">{value}</span>
                    <span className={`text-[9px] leading-tight ${
                      answers[question.id] === value ? 'text-white/80' : 'text-stone-400'
                    }`}>
                      {likertLabels[value]}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {(question.type === 'single_choice' || question.type === 'multiple_choice') && question.options && (
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

            {question.type === 'text' && (
              <Textarea
                placeholder="의견을 입력해 주세요..."
                rows={3}
                className="rounded-xl"
                value={(answers[question.id] as string) || ''}
                onChange={(e) => handleTextChange(question.id, e.target.value)}
              />
            )}

            {qIdx < currentSection.questions.length - 1 && (
              <div className="h-px bg-stone-100" />
            )}
          </div>
          )
        })}
      </div>

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
              disabled={isSubmitting || !allRequiredAnswered}
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
