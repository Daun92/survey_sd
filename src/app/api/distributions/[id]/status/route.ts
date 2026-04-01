import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api-utils'

export const PATCH = withAuth({ type: "public" }, async (request: NextRequest, ctx) => {
  const supabase = await createClient();

  try {
    const token = ctx.params?.id
    if (!token) return NextResponse.json({ error: 'Token이 필요합니다' }, { status: 400 })
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
});
