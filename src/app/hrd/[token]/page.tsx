import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { HrdSurveyForm } from './survey-form'

export default async function HrdSurveyPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // 응답자 정보 조회
  const { data: respondent } = await supabase
    .from('hrd_respondents')
    .select('*, round:hrd_survey_rounds(*)')
    .eq('url_token', token)
    .single()

  if (!respondent) return notFound()

  // 설문 문항 조회
  const { data: parts } = await supabase
    .from('hrd_survey_parts')
    .select('*, items:hrd_survey_items(*)')
    .eq('round_id', respondent.round_id)
    .eq('is_active', true)
    .order('sort_order')

  // 기존 응답 조회 (임시저장)
  const { data: existingResponses } = await supabase
    .from('hrd_responses')
    .select('item_id, value_text, value_number, value_json')
    .eq('respondent_id', respondent.id)

  const responseMap: Record<string, { text?: string; number?: number; json?: unknown }> = {}
  existingResponses?.forEach((r: { item_id: string; value_text: string | null; value_number: number | null; value_json: unknown }) => {
    responseMap[r.item_id] = {
      text: r.value_text || undefined,
      number: r.value_number || undefined,
      json: r.value_json || undefined,
    }
  })

  return (
    <HrdSurveyForm
      respondent={respondent}
      round={respondent.round}
      parts={(parts || []).map((p: any) => ({
        ...p,
        items: ((p.items || []) as Array<{ sort_order: number }>).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
      }))}
      existingResponses={responseMap}
      token={token}
    />
  )
}
