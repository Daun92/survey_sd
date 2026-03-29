import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRoleAPI } from '@/lib/auth'

// GET: 설정값 조회
export async function GET() {
  const auth = await requireRoleAPI('admin')
  if (auth.error) return auth.error

  try {
    const supabase = await createClient()
    const { data } = await supabase.from('app_settings').select('key, value')
    const settings: Record<string, string> = {}
    for (const row of data ?? []) {
      // API 키는 마스킹해서 반환
      if (row.key === 'gemini_api_key' && row.value) {
        settings[row.key] = row.value.slice(0, 6) + '...' + row.value.slice(-4)
        settings['gemini_api_key_set'] = 'true'
      } else {
        settings[row.key] = row.value ?? ''
      }
    }
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: '설정 조회 실패' }, { status: 500 })
  }
}

// POST: 설정값 저장
export async function POST(request: NextRequest) {
  const auth = await requireRoleAPI('admin')
  if (auth.error) return auth.error

  try {
    const supabase = await createClient()
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: 'key는 필수입니다' }, { status: 400 })
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) {
      console.error('Settings save error:', error)
      return NextResponse.json({ error: '설정 저장 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
