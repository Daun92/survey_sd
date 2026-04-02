/**
 * 설문 + 문항 로딩 공통 함수
 * /s/:token (공통 링크)와 /d/:token (개인 링크) 모두 이 함수를 사용하여
 * 데이터 전달 불일치를 방지합니다.
 */

interface SurveyQuestion {
  id: string
  code: string
  text: string
  type: string
  required: boolean
  options: string[] | null
  skip_logic: { show_when: { question_id: string; operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than'; value: string | number } } | null
  metadata: Record<string, unknown> | null
}

interface SurveySection {
  name: string
  questions: SurveyQuestion[]
}

export interface LoadedSurvey {
  id: string
  title: string
  description: string
  status: string
  token: string
  settings: Record<string, any>
  sessionName: string
  sections: SurveySection[]
}

/**
 * edu_surveys 레코드로부터 문항을 로드하고 섹션별로 그룹핑하여 반환
 */
/** 설문 settings 기본값 — undefined 필드를 안전하게 처리 */
const DEFAULT_SURVEY_SETTINGS = {
  collect_respondent_info: true,
  show_meta_info: true,
  show_progress: true,
  show_ending_stats: false,
  require_consent: false,
  anonymous: false,
}

export async function loadSurveyWithQuestions(
  supabase: { from: (table: string) => any },
  surveyRecord: {
    id: string
    title: string
    description: string | null
    status: string
    url_token: string
    settings: any
    sessions?: any
  }
): Promise<LoadedSurvey> {
  // 문항 로드
  const { data: questions } = await supabase
    .from('edu_questions')
    .select('id, section, question_code, question_text, question_type, is_required, sort_order, options, metadata, skip_logic')
    .eq('survey_id', surveyRecord.id)
    .order('sort_order', { ascending: true })

  // 섹션별 그룹핑
  const sectionMap = new Map<string, SurveySection>()
  for (const q of (questions ?? [])) {
    const sectionName = q.section || '기타'
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, { name: sectionName, questions: [] })
    }
    let parsedOptions: string[] | null = null
    if (q.options) {
      try {
        const o = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
        parsedOptions = Array.isArray(o) ? o.map(String) : null
      } catch { parsedOptions = null }
    }
    sectionMap.get(sectionName)!.questions.push({
      id: q.id,
      code: q.question_code,
      text: String(q.question_text ?? ''),
      type: String(q.question_type ?? 'text'),
      required: q.is_required === true,
      options: parsedOptions,
      skip_logic: (q as any).skip_logic ?? null,
      metadata: (q as any).metadata ?? null,
    })
  }

  const sessionInfo = surveyRecord.sessions as any
  const sessionName = sessionInfo?.name ?? ''
  const courseName = sessionInfo?.courses?.name ?? ''

  return {
    id: surveyRecord.id,
    title: surveyRecord.title,
    description: surveyRecord.description ?? '',
    status: surveyRecord.status,
    token: surveyRecord.url_token,
    settings: { ...DEFAULT_SURVEY_SETTINGS, ...((surveyRecord.settings as any) ?? {}) },
    sessionName: sessionName ? `${courseName} - ${sessionName}` : courseName,
    sections: Array.from(sectionMap.values()),
  }
}

/** 설문 기본 정보 select 쿼리 (edu_surveys) */
export const SURVEY_SELECT_FIELDS = `
  id, title, description, status, url_token, settings,
  education_type, session_id,
  sessions ( id, name, course_id,
    courses ( name, project_id,
      projects ( name, customers ( company_name ) )
    )
  )
`
