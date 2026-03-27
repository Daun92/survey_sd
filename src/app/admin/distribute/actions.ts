'use server'

import { createClient } from '@/lib/supabase/server'
import { createBatchSchema, type CreateBatchInput } from '@/lib/validations/distribution'

// ─── 배부 배치 + 개별 링크 생성 ───
export async function createDistributionBatch(input: CreateBatchInput) {
  const parsed = createBatchSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { survey_id, recipients } = parsed.data
  const supabase = await createClient()

  // 설문 존재 확인
  const { data: survey } = await supabase
    .from('edu_surveys')
    .select('id, status')
    .eq('id', survey_id)
    .single()

  if (!survey) {
    return { error: '설문을 찾을 수 없습니다' }
  }

  // 배치 생성
  const { data: batch, error: batchError } = await supabase
    .from('distribution_batches')
    .insert({
      survey_id,
      channel: 'link',
      total_count: recipients.length,
    })
    .select('id')
    .single()

  if (batchError || !batch) {
    console.error('Batch creation error:', batchError)
    return { error: '배부 배치 생성에 실패했습니다' }
  }

  // 개별 배부 레코드 생성
  const distributionRows = recipients.map((r) => ({
    batch_id: batch.id,
    survey_id,
    recipient_name: r.name,
    recipient_email: r.email || null,
    recipient_company: r.company || null,
    recipient_department: r.department || null,
    recipient_position: r.position || null,
    recipient_phone: r.phone || null,
    channel: 'link',
    status: 'pending',
  }))

  const { error: distError } = await supabase
    .from('distributions')
    .insert(distributionRows)

  if (distError) {
    console.error('Distribution creation error:', distError)
    return { error: '개별 링크 생성에 실패했습니다' }
  }

  return { success: true, batchId: batch.id }
}

// ─── 배부 배치 목록 조회 ───
export async function getDistributionBatches() {
  const supabase = await createClient()
  const { data: batches } = await supabase
    .from('distribution_batches')
    .select(`
      id, survey_id, channel, total_count, sent_count, opened_count, completed_count, created_at,
      edu_surveys ( title, status )
    `)
    .eq('channel', 'link')
    .order('created_at', { ascending: false })

  return (batches ?? []).map((b: any) => ({
    id: b.id,
    surveyId: b.survey_id,
    surveyTitle: b.edu_surveys?.title ?? '(삭제된 설문)',
    surveyStatus: b.edu_surveys?.status ?? 'unknown',
    totalCount: b.total_count,
    sentCount: b.sent_count,
    openedCount: b.opened_count,
    completedCount: b.completed_count,
    createdAt: b.created_at,
  }))
}

// ─── 배치 내 개별 배부 목록 조회 ───
export async function getDistributions(batchId: string) {
  const supabase = await createClient()
  const { data: distributions } = await supabase
    .from('distributions')
    .select('id, recipient_name, recipient_email, recipient_company, recipient_department, recipient_position, recipient_phone, unique_token, status, sent_at, opened_at, started_at, completed_at, created_at')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })

  return distributions ?? []
}

// ─── 배부 배치 삭제 ───
export async function deleteDistributionBatch(batchId: string) {
  const supabase = await createClient()
  // distributions는 CASCADE로 자동 삭제
  const { error } = await supabase
    .from('distribution_batches')
    .delete()
    .eq('id', batchId)

  if (error) {
    console.error('Batch deletion error:', error)
    return { error: '배부 배치 삭제에 실패했습니다' }
  }

  return { success: true }
}
