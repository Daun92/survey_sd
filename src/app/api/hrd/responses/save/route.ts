import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await req.json()
    const { token, respondent_id, round_id, answers, is_draft } = body

    if (!token || !respondent_id || !round_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 토큰 검증
    const { data: respondent } = await supabase
      .from('hrd_respondents')
      .select('id, status')
      .eq('id', respondent_id)
      .eq('url_token', token)
      .single()

    if (!respondent) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    if (respondent.status === 'completed') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 400 })
    }

    // 문항 ID 매핑 가져오기
    const { data: items } = await supabase
      .from('hrd_survey_items')
      .select('id, answer_type')
      .eq('round_id', round_id)

    const itemMap = new Map(items?.map((i: { id: string; answer_type: string }) => [i.id, i]) || [])

    // 응답 저장 (upsert)
    const upsertData = Object.entries(answers as Record<string, unknown>)
      .filter(([itemId]) => itemMap.has(itemId))
      .map(([itemId, value]) => {
        const item = itemMap.get(itemId)!
        const row: Record<string, unknown> = {
          respondent_id,
          item_id: itemId,
          round_id,
          value_text: null,
          value_number: null,
          value_json: null,
        }

        if (typeof value === 'number') {
          row.value_number = value
        } else if (typeof value === 'string') {
          if (['number', 'percent', 'currency'].includes((item as { answer_type: string }).answer_type)) {
            row.value_number = parseFloat(value) || null
          } else {
            row.value_text = value
          }
        } else if (typeof value === 'object') {
          row.value_json = value
        }

        return row
      })

    if (upsertData.length > 0) {
      // 기존 응답 삭제 후 재삽입
      await supabase
        .from('hrd_responses')
        .delete()
        .eq('respondent_id', respondent_id)
        .eq('round_id', round_id)

      const { error } = await supabase
        .from('hrd_responses')
        .insert(upsertData)

      if (error) {
        console.error('Response save error:', error)
        return NextResponse.json({ error: 'Failed to save responses' }, { status: 500 })
      }
    }

    // 응답자 상태 업데이트
    const updateData: Record<string, unknown> = {
      status: is_draft ? 'in_progress' : 'completed',
      updated_at: new Date().toISOString(),
    }

    if (!is_draft) {
      updateData.completed_at = new Date().toISOString()
    }

    if (!respondent.status || respondent.status === 'invited') {
      updateData.started_at = new Date().toISOString()
    }

    await supabase
      .from('hrd_respondents')
      .update(updateData)
      .eq('id', respondent_id)

    return NextResponse.json({
      success: true,
      saved_count: upsertData.length,
      status: is_draft ? 'draft_saved' : 'submitted',
    })
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
