import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSurveyQuestions } from '@/lib/gemini'
import { requireAuthAPI } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await requireAuthAPI()
  if (auth.error) return auth.error

  try {
    const supabase = await createClient()
    const body = await request.json()
    const { educationType, instructors, files, additionalPrompt } = body

    if (!files?.length && !additionalPrompt) {
      return NextResponse.json(
        { error: '첨부파일 또는 요청사항을 입력해주세요' },
        { status: 400 }
      )
    }

    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single()

    const apiKey = setting?.value
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API 키가 설정되지 않았습니다. 설정 페이지에서 입력해주세요.' },
        { status: 400 }
      )
    }

    const survey = await generateSurveyQuestions(
      apiKey,
      educationType || 'classroom',
      instructors || [],
      files || [],
      additionalPrompt
    )

    // 평탄화: 모든 문항을 하나의 배열로
    const allQuestions = [
      ...(survey.modules?.flatMap((m) => m.questions) ?? []),
      ...(survey.instructorQuestions ?? []),
      ...(survey.overallQuestions ?? []),
      ...(survey.openQuestions ?? []),
    ]

    return NextResponse.json({
      success: true,
      survey,
      questions: allQuestions,
      totalCount: allQuestions.length,
    })
  } catch (err: any) {
    console.error('AI generate questions error:', err)
    return NextResponse.json(
      { error: err.message || '문항 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}
