import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params

    // 설문 정보
    const { data: survey, error: surveyError } = await supabase
      .from('edu_surveys')
      .select('id, title, url_token')
      .eq('id', surveyId)
      .single()

    if (surveyError || !survey) {
      return NextResponse.json({ error: '설문을 찾을 수 없습니다' }, { status: 404 })
    }

    // 문항 조회 (정렬)
    const { data: questions } = await supabase
      .from('edu_questions')
      .select('id, question_code, question_text, question_type, section, sort_order')
      .eq('survey_id', surveyId)
      .order('sort_order', { ascending: true })

    const questionList = questions ?? []

    // 응답 조회
    const { data: submissions } = await supabase
      .from('edu_submissions')
      .select('id, respondent_name, respondent_department, respondent_position, answers, submitted_at, total_score')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: true })

    const submissionList = submissions ?? []

    // CSV 헤더 구성
    const headers = [
      '응답번호',
      '응답일시',
      '응답자명',
      '소속',
      '직위',
      ...questionList.map((q) => q.question_code || q.question_text.slice(0, 30)),
      '총점',
    ]

    // CSV 행 구성
    const rows = submissionList.map((sub, idx) => {
      const answers = (sub.answers ?? {}) as Record<string, string | number>
      const questionAnswers = questionList.map((q) => {
        const val = answers[q.id]
        if (val === undefined || val === null) return ''
        return String(val)
      })

      return [
        String(idx + 1),
        sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('ko-KR') : '',
        sub.respondent_name ?? '',
        sub.respondent_department ?? '',
        sub.respondent_position ?? '',
        ...questionAnswers,
        sub.total_score != null ? String(sub.total_score) : '',
      ]
    })

    // CSV 생성 (Excel 한글 호환을 위한 BOM 추가)
    const BOM = '\uFEFF'
    const csvContent = BOM + [
      headers.map(escapeCsvField).join(','),
      ...rows.map((row) => row.map(escapeCsvField).join(',')),
    ].join('\n')

    const filename = `survey_export_${survey.title.replace(/[^가-힣a-zA-Z0-9]/g, '_').slice(0, 30)}.csv`

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: '내보내기에 실패했습니다' }, { status: 500 })
  }
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}
