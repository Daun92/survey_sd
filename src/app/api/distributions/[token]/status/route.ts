import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { status } = await request.json()

    if (!['opened', 'started'].includes(status)) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다' }, { status: 400 })
    }

    const timestampField = status === 'opened' ? 'opened_at' : 'started_at'

    const { error } = await supabase
      .from('distributions')
      .update({
        status,
        [timestampField]: new Date().toISOString(),
      })
      .eq('unique_token', token)

    if (error) {
      return NextResponse.json({ error: '상태 업데이트 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
