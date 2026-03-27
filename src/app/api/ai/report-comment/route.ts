import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateReportComment, type ReportData } from '@/lib/gemini'
import { requireAuthAPI } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await requireAuthAPI()
  if (auth.error) return auth.error

  try {
    const body: ReportData = await request.json()

    if (!body.courseName || !body.overallAvg) {
      return NextResponse.json({ error: '필수 데이터가 누락되었습니다' }, { status: 400 })
    }

    // Gemini API 키 조회
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

    const comment = await generateReportComment(apiKey, body)
    return NextResponse.json({ success: true, comment })
  } catch (err: any) {
    console.error('AI report comment error:', err)
    return NextResponse.json(
      { error: err.message || 'AI 코멘트 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}
