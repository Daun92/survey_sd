import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import SurveyForm from '@/app/s/[token]/survey-form'

export const dynamic = 'force-dynamic'

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
  }[]
}

async function getDistributionByToken(token: string) {
  // 1. distribution 조회
  const { data: dist, error: distErr } = await supabase
    .from('distributions')
    .select('id, survey_id, respondent_id, status, unique_token')
    .eq('unique_token', token)
    .single()

  if (distErr || !dist) return null

  // 2. survey 데이터 조회 (기존 /s/[token] 패턴 재사용)
  const { data: survey, error: surveyErr } = await supabase
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
    .eq('id', dist.survey_id)
    .single()

  if (surveyErr || !survey) return null

  // 3. 문항 로드
  const { data: questions } = await supabase
    .from('edu_questions')
    .select('id, section, question_code, question_text, question_type, is_required, sort_order, options, metadata, skip_logic')
    .eq('survey_id', survey.id)
    .order('sort_order', { ascending: true })

  // 4. 섹션 그룹핑
  const sectionMap = new Map<string, SurveySection>()
  for (const q of (questions ?? [])) {
    const sectionName = q.section || '기타'
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, { name: sectionName, questions: [] })
    }
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
    })
  }

  // 5. 응답자 정보 조회
  let prefillRespondent: { name?: string; department?: string; position?: string } = {}
  if (dist.respondent_id) {
    const { data: respondent } = await supabase
      .from('respondents')
      .select('name, department, position')
      .eq('id', dist.respondent_id)
      .single()
    if (respondent) {
      prefillRespondent = {
        name: respondent.name ?? undefined,
        department: respondent.department ?? undefined,
        position: respondent.position ?? undefined,
      }
    }
  }

  // 6. opened 상태 업데이트 (pending → opened)
  if (dist.status === 'pending' || dist.status === 'sent') {
    await supabase
      .from('distributions')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', dist.id)
  }

  const sessionInfo = survey.sessions as any
  const sessionName = sessionInfo?.name ?? ''
  const courseName = sessionInfo?.courses?.name ?? ''

  return {
    distribution: {
      id: dist.id,
      token: dist.unique_token,
      status: dist.status,
    },
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description ?? '',
      status: survey.status,
      token: survey.url_token,
      settings: (survey.settings as any) ?? {},
      sessionName: sessionName ? `${courseName} - ${sessionName}` : courseName,
      sections: Array.from(sectionMap.values()),
    },
    prefillRespondent,
  }
}

export default async function DistributionEntryPage({ params }: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getDistributionByToken(token)

  if (!data) {
    notFound()
  }

  // 이미 완료된 경우
  if (data.distribution.status === 'completed') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white rounded-xl shadow-sm border border-stone-200 p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">이미 응답을 완료했습니다</h2>
          <p className="text-sm text-stone-500">이 설문에 대한 응답이 이미 제출되었습니다.<br />감사합니다.</p>
        </div>
      </div>
    )
  }

  // 설문 비활성 상태
  if (data.survey.status !== 'active') {
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

  return (
    <SurveyForm
      survey={data.survey}
      groupToken={null}
      distributionToken={data.distribution.token}
      prefillRespondent={data.prefillRespondent}
    />
  )
}
