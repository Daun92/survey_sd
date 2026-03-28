import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { submitSurveySchema } from '@/lib/validations/submission'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params
    const body = await request.json()

    const parsed = submitSurveySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값 오류: ' + parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { answers, respondent_name, respondent_department, respondent_position, class_group_id, distribution_token } = parsed.data

    // 설문 조회
    const { data: survey, error: surveyError } = await supabase
      .from('edu_surveys')
      .select('id, session_id, status')
      .eq('url_token', token)
      .single()

    if (surveyError || !survey) {
      return NextResponse.json({ error: '설문을 찾을 수 없습니다' }, { status: 404 })
    }

    if (survey.status !== 'active') {
      return NextResponse.json({ error: '현재 응답을 받지 않는 설문입니다' }, { status: 403 })
    }

    // class_group_id: 토큰 문자열이면 실제 UUID로 변환
    let resolvedGroupId = null
    if (class_group_id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(class_group_id)
      if (isUuid) {
        resolvedGroupId = class_group_id
      } else {
        const { data: group } = await supabase
          .from('class_groups')
          .select('id')
          .eq('survey_url_token', class_group_id)
          .single()
        resolvedGroupId = group?.id ?? null
      }
    }

    // total_score 계산 (숫자형 응답 합산)
    const totalScore = Object.values(answers).reduce((sum: number, val) => {
      const num = Number(val)
      return !isNaN(num) && typeof val === 'number' ? sum + num : sum
    }, 0)

    // 응답 저장
    const { data: submission, error: submitError } = await supabase
      .from('edu_submissions')
      .insert({
        survey_id: survey.id,
        session_id: survey.session_id,
        class_group_id: resolvedGroupId,
        respondent_name: respondent_name || null,
        respondent_department: respondent_department || null,
        respondent_position: respondent_position || null,
        answers,
        total_score: totalScore,
        channel: 'online',
        is_complete: true,
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
        user_agent: request.headers.get('user-agent') || null,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (submitError) {
      console.error('Submission error:', submitError)
      return NextResponse.json({ error: '응답 저장에 실패했습니다' }, { status: 500 })
    }

    // distribution 완료 처리
    if (distribution_token) {
      await supabase
        .from('distributions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('unique_token', distribution_token)
    }

    return NextResponse.json({ success: true, id: submission.id })
  } catch (err) {
    console.error('Submit API error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
