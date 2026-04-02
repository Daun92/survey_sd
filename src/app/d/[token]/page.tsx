import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SurveyForm from '@/app/s/[token]/survey-form'
import { loadSurveyWithQuestions, SURVEY_SELECT_FIELDS } from '@/lib/survey-loader'

export const dynamic = 'force-dynamic'

async function getDistributionByToken(token: string) {
  const supabase = await createClient()

  // 1. distribution 조회
  const { data: dist, error: distErr } = await supabase
    .from('distributions')
    .select('id, survey_id, respondent_id, recipient_name, recipient_email, status, unique_token')
    .eq('unique_token', token)
    .single()

  if (distErr || !dist) return null

  // 2. survey 데이터 조회
  const { data: survey, error: surveyErr } = await supabase
    .from('edu_surveys')
    .select(SURVEY_SELECT_FIELDS)
    .eq('id', dist.survey_id)
    .single()

  if (surveyErr || !survey) return null

  // 3. 공통 함수로 문항 로드 + 섹션 그룹핑
  const loadedSurvey = await loadSurveyWithQuestions(supabase, survey)

  // 4. opened 상태 업데이트 (pending → opened)
  if (dist.status === 'pending' || dist.status === 'sent') {
    await supabase
      .from('distributions')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', dist.id)
  }

  return {
    distribution: {
      id: dist.id,
      token: dist.unique_token,
      status: dist.status,
    },
    survey: loadedSurvey,
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
    const isDraft = data.survey.status === 'draft'
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white rounded-xl shadow-sm border border-stone-200 p-8">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isDraft ? 'bg-amber-100' : 'bg-stone-100'}`}>
            <svg className={`h-8 w-8 ${isDraft ? 'text-amber-500' : 'text-stone-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">
            {isDraft ? '설문이 아직 시작되지 않았습니다' : '설문이 종료되었습니다'}
          </h2>
          <p className="text-sm text-stone-500">
            {isDraft
              ? '이 설문은 준비 중입니다. 잠시 후 다시 시도해주세요.'
              : '이 설문은 현재 응답을 받지 않고 있습니다.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <SurveyForm
      survey={data.survey}
      groupToken={null}
      distributionToken={data.distribution.token}
    />
  )
}
