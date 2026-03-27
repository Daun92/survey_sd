import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import SurveyForm from './survey-form'

interface SurveySection {
  name: string
  questions: {
    id: string
    code: string
    text: string
    type: string
    required: boolean
    options?: string[] | null
    skip_logic?: { show_when: { question_id: string; operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than'; value: string | number } } | null
    metadata?: Record<string, unknown> | null
  }[]
}

async function getSurveyByToken(token: string) {
  try {
    // 설문 기본 정보
    const { data: survey, error } = await supabase
      .from('edu_surveys')
      .select(`
        id, title, description, status, url_token, settings,
        education_type, session_id,
        sessions ( id, name, course_id,
          courses ( name, project_id,
            projects ( name, customers ( company_name ) )
          )
        )
      `)
      .eq('url_token', token)
      .single()

    if (error || !survey) return null

    // 설문 문항
    const { data: questions } = await supabase
      .from('edu_questions')
      .select('id, section, question_code, question_text, question_type, is_required, sort_order, options, metadata, skip_logic')
      .eq('survey_id', survey.id)
      .order('sort_order', { ascending: true })

    // 섹션별로 그룹핑
    const sectionMap = new Map<string, SurveySection>()
    for (const q of (questions ?? [])) {
      const sectionName = q.section || '기타'
      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, { name: sectionName, questions: [] })
      }
      // Parse options safely
      let parsedOptions: string[] | null = null
      if (q.options) {
        try {
          const o = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
          parsedOptions = Array.isArray(o) ? o.map(String) : null
        } catch { parsedOptions = null }
      }

      sectionMap.get(sectionName)!.questions.push({
        id: q.id,
        code: q.question_code,
        text: String(q.question_text ?? ''),
        type: String(q.question_type ?? 'text'),
        required: q.is_required === true,
        options: parsedOptions,
        skip_logic: (q as any).skip_logic ?? null,
        metadata: (q as any).metadata ?? null,
      })
    }

    const sessionInfo = survey.sessions as any
    const sessionName = sessionInfo?.name ?? ''
    const courseName = sessionInfo?.courses?.name ?? ''

    return {
      id: survey.id,
      title: survey.title,
      description: survey.description ?? '',
      status: survey.status,
      token: survey.url_token,
      settings: (survey.settings as any) ?? {},
      sessionName: sessionName ? `${courseName} - ${sessionName}` : courseName,
      sections: Array.from(sectionMap.values()),
    }
  } catch (e) {
    console.error('Survey fetch error:', e)
    return null
  }
}

export default async function SurveyResponsePage({ params, searchParams }: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ group?: string }>
}) {
  const { token } = await params
  const { group } = await searchParams

  const survey = await getSurveyByToken(token)

  if (!survey) {
    notFound()
  }

  if (survey.status !== 'active') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white rounded-xl shadow-sm border border-stone-200 p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
            <svg className="h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">설문이 종료되었습니다</h2>
          <p className="text-sm text-stone-500">이 설문은 현재 응답을 받지 않고 있습니다.</p>
        </div>
      </div>
    )
  }

  return <SurveyForm survey={survey} groupToken={group ?? null} />
}
