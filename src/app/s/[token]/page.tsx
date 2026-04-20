import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SurveyForm from './survey-form'
import { loadSurveyWithQuestions, SURVEY_SELECT_FIELDS } from '@/lib/survey-loader'

// 설문 데이터는 항상 최신 상태를 반영해야 함
export const dynamic = 'force-dynamic'

async function getSurveyByToken(token: string) {
  try {
    const supabase = await createClient()

    const { data: survey, error } = await supabase
      .from('edu_surveys')
      .select(SURVEY_SELECT_FIELDS)
      .eq('url_token', token)
      .single()

    if (error || !survey) return null

    return await loadSurveyWithQuestions(supabase, survey)
  } catch (e) {
    console.error('Survey fetch error:', e)
    return null
  }
}

export default async function SurveyResponsePage({ params, searchParams }: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ group?: string; test?: string }>
}) {
  const { token } = await params
  const { group, test } = await searchParams
  const isTestMode = test === '1'

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

  return <SurveyForm survey={survey} groupToken={group ?? null} isTestMode={isTestMode} />
}
