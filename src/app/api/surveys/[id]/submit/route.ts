import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitSurveySchema } from '@/lib/validations/submission'
import { withAuth } from '@/lib/api-utils'

export const POST = withAuth({ type: "public" }, async (request: NextRequest, ctx) => {
  const supabase = createAdminClient()

  const token = ctx.params?.id
  if (!token) return NextResponse.json({ error: 'Token이 필요합니다' }, { status: 400 })

  try {
    const body = await request.json()

    const parsed = submitSurveySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값 오류: ' + parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { answers, respondent_name, respondent_department, respondent_position, class_group_id, distribution_token, is_test: bodyIsTest } = parsed.data

    // URL 쿼리 ?test=1 도 테스트 신호로 수용 (공통 링크 ?test=1 → 클라이언트가 body 로도 전달하지만 fallback)
    const urlIsTest = request.nextUrl?.searchParams.get('test') === '1'

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

    // 개별 링크(distribution) 정보 조회
    let distRespondentName = respondent_name
    let distributionId: string | null = null
    let respondentId: string | null = null
    // 테스트 제출 여부: 공통 링크 ?test=1, body.is_test, 또는 테스트 배치 — 어느 하나라도 true 면 test 로 분류
    let isTestSubmission = Boolean(bodyIsTest) || urlIsTest
    if (distribution_token) {
      const { data: dist } = await supabase
        .from('distributions')
        .select('id, recipient_name, recipient_email, status, batch_id, respondent_id')
        .eq('unique_token', distribution_token)
        .eq('survey_id', survey.id)
        .single()

      if (dist) {
        if (dist.status === 'completed') {
          return NextResponse.json({ error: '이미 응답을 완료한 링크입니다' }, { status: 400 })
        }
        distributionId = dist.id
        respondentId = dist.respondent_id ?? null
        distRespondentName = dist.recipient_name || respondent_name
        // 테스트 배치 여부 확인
        if (dist.batch_id) {
          const { data: batch } = await supabase
            .from('distribution_batches')
            .select('is_test')
            .eq('id', dist.batch_id)
            .single()
          if (batch?.is_test) isTestSubmission = true
        }
      }
    }

    // total_score 계산 (숫자형 응답 합산 — 문자열 숫자도 포함)
    const totalScore = Object.values(answers).reduce((sum: number, val) => {
      if (val === null || val === undefined || val === '') return sum
      const num = Number(val)
      return !isNaN(num) ? sum + num : sum
    }, 0)

    // 응답 저장
    const { data: submission, error: submitError } = await supabase
      .from('edu_submissions')
      .insert({
        survey_id: survey.id,
        session_id: survey.session_id,
        class_group_id: resolvedGroupId,
        distribution_id: distributionId,
        // 개인 링크 경로면 distribution 의 respondent_id 를 그대로 복사해 주소록과 연결.
        // 공통 링크(/s) 는 respondent 불명이라 null 유지.
        respondent_id: respondentId,
        respondent_name: distRespondentName || null,
        respondent_department: respondent_department || null,
        respondent_position: respondent_position || null,
        answers,
        total_score: totalScore,
        channel: 'online',
        is_complete: true,
        is_test: isTestSubmission,
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
    if (distributionId) {
      await supabase
        .from('distributions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', distributionId)
    }

    return NextResponse.json({ success: true, id: submission.id })
  } catch (err) {
    console.error('Submit API error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
});
