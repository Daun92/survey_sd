'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2, ChevronRight, ChevronLeft, Clock, FileText, Shield } from 'lucide-react'

interface SurveyQuestion {
  id: string
  code: string
  text: string
  type: string
  required: boolean
}

interface SurveySection {
  name: string
  questions: SurveyQuestion[]
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
  }
  sessionName: string
  sections: SurveySection[]
}

type Step = 'landing' | 'questions' | 'ending'

const likertLabels: Record<number, string> = { 5: '매우 만족', 4: '만족', 3: '보통', 2: '불만족', 1: '매우 불만족' }

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
  const [respondentName, setRespondentName] = useState('')
  const [respondentDept, setRespondentDept] = useState('')
  const [respondentPosition, setRespondentPosition] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startTimeRef = useRef<number>(0)
  const [elapsedTime, setElapsedTime] = useState('')

  const allQuestions = survey.sections.flatMap((s) => s.questions)
  const totalLikert = allQuestions.filter((q) => q.type === 'likert_5').length
  const answeredLikert = Object.entries(answers).filter(([, v]) => typeof v === 'number').length
  const progress = totalLikert > 0 ? Math.round((answeredLikert / totalLikert) * 100) : 0
  const requiredLikert = allQuestions.filter((q) => q.type === 'likert_5' && q.required)
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
    window.scrollTo(0, 0)
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
          respondent_name: respondentName || null,
          respondent_department: respondentDept || null,
          respondent_position: respondentPosition || null,
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
      window.scrollTo(0, 0)
    } catch (err) {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Landing Page ───
  if (step === 'landing') {
    return (
      <MobileFrame>
      <div className="flex-1 flex flex-col bg-stone-50">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-stone-100">
          <Image src="/logo.png" alt="EXPERT" width={100} height={20} className="h-5 w-auto" />
          <span className="text-[11px] text-stone-400 tracking-wide">Satisfaction Survey</span>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center pt-12 pb-8 px-6">
          <h1 className="text-[22px] font-bold text-stone-900 text-center leading-tight tracking-tight">
            {survey.title}
          </h1>
          {survey.sessionName && (
            <p className="text-sm text-stone-500 mt-2">{survey.sessionName}</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-6 space-y-3">
          {/* Description */}
          {survey.description && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-stone-800 mb-1.5">안내사항</p>
              <p className="text-[13px] text-stone-500 leading-relaxed">{survey.description}</p>
            </div>
          )}

          {/* Meta Info */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-1.5 py-4 bg-white border border-stone-200 rounded-xl flex-1">
              <Clock size={18} className="text-teal-600" />
              <span className="text-lg font-bold text-stone-800">{estimatedMinutes}분</span>
              <span className="text-[11px] text-stone-400">예상 소요 시간</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 py-4 bg-white border border-stone-200 rounded-xl flex-1">
              <FileText size={18} className="text-teal-600" />
              <span className="text-lg font-bold text-stone-800">{allQuestions.length}문항</span>
              <span className="text-[11px] text-stone-400">총 문항 수</span>
            </div>
          </div>

          {/* Respondent Info */}
          {survey.settings.collect_respondent_info !== false && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-stone-400 uppercase tracking-widest">응답자 정보 (선택)</p>
              <div className="flex gap-2">
                <Input
                  placeholder="이름"
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  className="h-10 rounded-xl"
                />
                <Input
                  placeholder="소속"
                  value={respondentDept}
                  onChange={(e) => setRespondentDept(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="px-6 pb-8 pt-6">
          <button
            onClick={handleStart}
            className="w-full h-[52px] bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            설문 시작하기
            <ChevronRight size={18} />
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <Shield size={12} className="text-stone-400" />
            <span className="text-[11px] text-stone-400">{survey.settings.landing_notice || '모든 응답은 익명으로 안전하게 처리됩니다'}</span>
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
          <Image src="/logo.png" alt="EXPERT" width={80} height={16} className="h-4 w-auto opacity-30" />
          <span className="text-[11px] text-stone-300">Powered by EXC-Survey</span>
        </div>
      </div>
      </MobileFrame>
    )
  }

  // ─── Questions Page ───
  return (
    <MobileFrame>
    <div className="flex-1 flex flex-col bg-stone-50 overflow-y-auto">
      {/* Header with progress */}
      <div className="bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3.5">
          <button
            onClick={() => setStep('landing')}
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
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-6 space-y-6">
        {survey.sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="space-y-5">
            {survey.sections.length > 1 && (
              <div className="flex items-center gap-2 pb-1">
                <span className="text-[13px] font-semibold text-teal-600">{sectionIdx + 1}/{survey.sections.length}</span>
                <span className="text-[15px] font-semibold text-stone-800">{section.name}</span>
              </div>
            )}
            {section.questions.map((question, qIdx) => (
              <div key={question.id} className="space-y-3">
                <p className="text-[15px] text-stone-800 leading-relaxed">
                  <span className="text-[13px] font-semibold text-teal-600 mr-2">
                    {String(qIdx + 1).padStart(2, '0')}
                  </span>
                  {question.text}
                  {question.required && <span className="text-rose-400 ml-1">*</span>}
                </p>

                {question.type === 'likert_5' && (
                  <div className="flex gap-1.5">
                    {[5, 4, 3, 2, 1].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleLikertChange(question.id, value)}
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

                {question.type === 'text' && (
                  <Textarea
                    placeholder="의견을 입력해 주세요..."
                    rows={3}
                    className="rounded-xl"
                    value={(answers[question.id] as string) || ''}
                    onChange={(e) => handleTextChange(question.id, e.target.value)}
                  />
                )}

                {qIdx < section.questions.length - 1 && (
                  <div className="h-px bg-stone-100" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mb-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Bottom Nav */}
      <div className="bg-white border-t border-stone-100 sticky bottom-0">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between px-6 py-4">
          <button
            onClick={() => setStep('landing')}
            className="flex items-center gap-1 text-stone-500 hover:text-stone-700 transition-colors"
          >
            <ChevronLeft size={16} />
            <span className="text-sm font-medium">이전</span>
          </button>
          <span className="text-xs text-stone-400">{answeredLikert}/{totalLikert} 응답 완료</span>
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
        </div>
      </div>
    </div>
    </MobileFrame>
  )
}
