import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { analyzeOpenResponses } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { questionText, responses } = body

    if (!questionText || !responses?.length) {
      return NextResponse.json({ error: '문항 텍스트와 응답 데이터가 필요합니다' }, { status: 400 })
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

    const analysis = await analyzeOpenResponses(apiKey, questionText, responses)
    return NextResponse.json({ success: true, analysis })
  } catch (err: any) {
    console.error('AI analyze responses error:', err)
    return NextResponse.json(
      { error: err.message || '서술형 응답 분석에 실패했습니다' },
      { status: 500 }
    )
  }
}
