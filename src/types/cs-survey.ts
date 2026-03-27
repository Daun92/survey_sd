// CS 만족도 설문 템플릿 관련 타입

export type CsDivision = 'classroom' | 'remote' | 'content_dev' | 'smart' | 'hrm' | 'hr_consulting'
export type PageType = '1P' | '2P' | 'eco'
export type MappingStatus = 'matched' | 'mismatched' | 'unknown'
export type WarningSeverity = 'info' | 'warning' | 'critical'
export type CsQuestionType = 'likert_5' | 'likert_6' | 'likert_5_na' | 'single_choice' | 'text'

export interface CsSurveyTemplate {
  id: string
  division: CsDivision
  division_label: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  cs_survey_questions?: CsSurveyQuestion[]
  cs_survey_warnings?: CsSurveyWarning[]
}

export interface CsSurveyQuestion {
  id: string
  template_id: string
  page_type: PageType
  question_no: string
  result_column: string
  question_text: string
  question_type: CsQuestionType
  response_options: string | null
  section_label: string | null
  mapping_status: MappingStatus
  sort_order: number
  notes: string | null
  created_at: string
}

export interface CsSurveyWarning {
  id: string
  template_id: string
  warning_type: string
  description: string
  affected_questions: string | null
  affected_columns: string | null
  action_required: string
  severity: WarningSeverity
  is_resolved: boolean
  created_at: string
}

// 부문별 라벨 매핑
export const DIVISION_LABELS: Record<CsDivision, string> = {
  classroom: '집체',
  remote: '원격',
  content_dev: '콘텐츠개발',
  smart: '스마트훈련',
  hrm: 'HRM채용대행',
  hr_consulting: 'HR컨설팅',
}

// 부문별 컬러 매핑
export const DIVISION_COLORS: Record<CsDivision, { bg: string; text: string; border: string }> = {
  classroom:      { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  remote:         { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  content_dev:    { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  smart:          { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  hrm:            { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200' },
  hr_consulting:  { bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200' },
}

// 페이지 타입 라벨
export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  '1P': '1페이지',
  '2P': '2페이지',
  'eco': '에코시스템',
}

// 매핑 상태 라벨
export const MAPPING_STATUS_CONFIG: Record<MappingStatus, { label: string; color: string }> = {
  matched:    { label: '일치',   color: 'text-green-600' },
  mismatched: { label: '불일치', color: 'text-amber-600' },
  unknown:    { label: '미확인', color: 'text-red-600' },
}

// 문항 유형 라벨
export const QUESTION_TYPE_LABELS: Record<CsQuestionType, string> = {
  likert_5:    '5점 척도',
  likert_6:    '6점 척도',
  likert_5_na: '5점+해당없음',
  single_choice: '단일선택',
  text:        '주관식',
}
