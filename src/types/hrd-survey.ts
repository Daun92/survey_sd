// =============================================
// HRD 실태조사 TypeScript 타입 정의
// =============================================

export type HrdRoundStatus = 'draft' | 'collecting' | 'closed' | 'analyzing' | 'published'
export type HrdRespondentStatus = 'invited' | 'in_progress' | 'completed' | 'verified'
export type HrdReportStatus = 'pending' | 'generating' | 'generated' | 'reviewed' | 'published'
export type HrdSource = 'online' | 'phone' | 'paper' | 'import'

export type HrdAnswerType =
  | 'text' | 'number' | 'percent' | 'currency'
  | 'single_choice' | 'multiple_choice'
  | 'likert_5' | 'likert_importance_performance'
  | 'rank_order' | 'comma_separated'
  | 'year_month' | 'email' | 'phone' | 'date'

export type OrgTypeCode = 1 | 2 | 3 | 4 | 5

export const ORG_TYPE_LABELS: Record<OrgTypeCode, string> = {
  1: '대기업',
  2: '중기업',
  3: '소기업',
  4: '공공기관',
  5: '학교',
}

export const HRD_ROUND_STATUS_LABELS: Record<HrdRoundStatus, string> = {
  draft: '준비 중',
  collecting: '수집 중',
  closed: '수집 완료',
  analyzing: '분석 중',
  published: '발행 완료',
}

export const HRD_PART_CODES = {
  BASIC_INFO: 'basic_info',
  P1_EDU_INDICATORS: 'p1',
  P2_HRD_STATUS: 'p2',
  P3_HRD_ACTIVITIES: 'p3',
  P4_HRD_ISSUES: 'p4',
  P5_AI_ADOPTION: 'p5',
} as const

export const HRD_PART_NAMES: Record<string, string> = {
  basic_info: '기본정보',
  p1: 'I. 교육관련 지표',
  p2: 'II. HRD 현황',
  p3: 'III. HRD 활동',
  p4: 'IV. HRD 이슈',
  p5: 'V. AI 도입과 활용',
}

export const INDUSTRY_CODES: Record<string, string> = {
  '1': '전자/반도체/통신',
  '2': '건설',
  '3': '자동차/철강',
  '4': '항공/철도/조선',
  '5': '에너지/환경/화학',
  '6': '패션/유통/식품',
  '7': '의료/제약/바이오',
  '8': '금융/은행/보험',
  '9': 'IT/SW',
  '10': '교육/연구',
  '11': '여행/관광/레저',
  '12': '아동/청소년/복지',
  '13': '일반서비스',
  'etc': '기타',
}

// =============================================
// 엔티티 인터페이스
// =============================================

export interface HrdSurveyRound {
  id: string
  round_number: number
  title: string
  description?: string
  year: number
  status: HrdRoundStatus
  starts_at?: string
  ends_at?: string
  target_count: number
  settings: HrdRoundSettings
  created_at: string
  updated_at: string
  // Relations
  parts?: HrdSurveyPart[]
}

export interface HrdRoundSettings {
  allow_save_draft?: boolean
  require_biz_reg_no?: boolean
  show_progress_bar?: boolean
  welcome_message?: string
  thank_you_message?: string
  reminder_emails?: boolean
}

export interface HrdSurveyPart {
  id: string
  round_id: string
  part_code: string
  part_name: string
  sort_order: number
  description?: string
  is_active: boolean
  created_at: string
  // Relations
  items?: HrdSurveyItem[]
}

export interface HrdSurveyItem {
  id: string
  part_id: string
  round_id: string
  item_code: string
  question_text: string
  sub_item_text?: string
  question_group?: string
  answer_type: HrdAnswerType
  answer_options?: AnswerOption[]
  is_required: boolean
  sort_order: number
  validation_rules?: ValidationRule
  conditional_logic?: ConditionalLogic
  placeholder?: string
  unit?: string
  help_text?: string
  analysis_group?: string
  is_benchmark_item: boolean
  benchmark_comparison?: 'mean' | 'median' | 'distribution'
  created_at: string
  updated_at: string
}

export interface AnswerOption {
  value: number | string
  label: string
}

export interface ValidationRule {
  min?: number
  max?: number
  sum_group?: string        // 합계가 100%가 되어야 하는 그룹
  sum_target?: number       // 합계 목표값 (기본 100)
  pattern?: string          // 정규식 패턴
  custom_message?: string
}

export interface ConditionalLogic {
  show_if?: {
    item_code: string
    operator: 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'lt'
    value: number | string | (number | string)[]
  }
}

export interface HrdRespondent {
  id: string
  round_id: string
  respondent_name?: string
  respondent_position?: string
  respondent_email?: string
  respondent_phone?: string
  respondent_mobile?: string
  respondent_gender?: 'M' | 'F'
  org_type?: string
  org_type_code?: OrgTypeCode
  company_name: string
  department_name?: string
  industry_code?: string
  industry_name?: string
  biz_reg_no?: string
  address_road?: string
  address_detail?: string
  zipcode?: string
  recommender?: string
  url_token: string
  status: HrdRespondentStatus
  invited_at?: string
  started_at?: string
  completed_at?: string
  verified_at?: string
  source: HrdSource
  notes?: string
  created_at: string
  updated_at: string
}

export interface HrdResponse {
  id: string
  respondent_id: string
  item_id: string
  round_id: string
  value_text?: string
  value_number?: number
  value_json?: unknown
  created_at: string
  updated_at: string
}

export interface HrdBenchmarkCache {
  id: string
  round_id: string
  item_id: string
  group_type: string
  response_count: number
  mean_value?: number
  median_value?: number
  std_dev?: number
  min_value?: number
  max_value?: number
  q1_value?: number
  q3_value?: number
  distribution?: Record<string, number>
  percentiles?: Record<string, number>
  calculated_at: string
}

export interface HrdConsultingReport {
  id: string
  respondent_id: string
  round_id: string
  report_data: ConsultingReportData
  ai_summary?: string
  ai_recommendations?: AiRecommendation[]
  status: HrdReportStatus
  generated_at?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
}

// =============================================
// 분석/리포트 관련 타입
// =============================================

export interface ConsultingReportData {
  company_info: {
    name: string
    org_type: string
    industry: string
    employee_count?: number
    edu_budget?: number
  }
  sections: ReportSection[]
  overall_score?: number
  peer_comparison?: PeerComparison
}

export interface ReportSection {
  part_code: string
  part_name: string
  items: ReportItem[]
  section_summary?: string
}

export interface ReportItem {
  item_code: string
  question_text: string
  company_value: number | string
  peer_mean?: number
  peer_median?: number
  all_mean?: number
  all_median?: number
  percentile_rank?: number  // 백분위
  status: 'above' | 'at' | 'below'  // 동종업계 대비
}

export interface PeerComparison {
  peer_group: string         // '대기업', '중기업' 등
  peer_count: number
  strengths: string[]
  weaknesses: string[]
}

export interface AiRecommendation {
  area: string
  priority: 'high' | 'medium' | 'low'
  current_status: string
  recommendation: string
  expected_impact: string
}

// =============================================
// 대시보드 관련 타입
// =============================================

export interface HrdDashboardData {
  round: HrdSurveyRound
  response_summary: ResponseSummary
  daily_responses: DailyResponse[]
  org_type_breakdown: OrgTypeBreakdown[]
  industry_breakdown: IndustryBreakdown[]
  recent_respondents: HrdRespondent[]
}

export interface ResponseSummary {
  total_respondents: number
  completed_count: number
  in_progress_count: number
  invited_count: number
  completion_rate: number
  target_count: number
  large_enterprise_count: number
  medium_enterprise_count: number
  small_enterprise_count: number
  public_institution_count: number
  school_count: number
}

export interface DailyResponse {
  date: string
  count: number
  cumulative: number
}

export interface OrgTypeBreakdown {
  org_type_code: OrgTypeCode
  org_type_name: string
  count: number
  percentage: number
}

export interface IndustryBreakdown {
  industry_code: string
  industry_name: string
  count: number
  percentage: number
}

// =============================================
// 전체 통계 리포트 타입
// =============================================

export interface OverallStatisticsReport {
  round: HrdSurveyRound
  respondent_profile: RespondentProfile
  part_summaries: PartSummary[]
  key_findings: KeyFinding[]
  year_over_year?: YearOverYearComparison[]
}

export interface RespondentProfile {
  total_count: number
  by_org_type: OrgTypeBreakdown[]
  by_industry: IndustryBreakdown[]
  by_gender: { male: number; female: number; unknown: number }
}

export interface PartSummary {
  part_code: string
  part_name: string
  highlights: StatHighlight[]
  charts: ChartData[]
}

export interface StatHighlight {
  label: string
  value: string | number
  unit?: string
  change?: number           // 전년 대비 변화
  change_direction?: 'up' | 'down' | 'flat'
}

export interface ChartData {
  chart_type: 'bar' | 'horizontal_bar' | 'pie' | 'radar' | 'line' | 'stacked_bar' | 'heatmap'
  title: string
  data: Record<string, unknown>[]
  x_key?: string
  y_keys?: string[]
  labels?: string[]
}

export interface KeyFinding {
  area: string
  finding: string
  supporting_data: string
  implication: string
}

export interface YearOverYearComparison {
  item_code: string
  item_label: string
  current_value: number
  previous_value: number
  change: number
  change_percent: number
}

// =============================================
// HRD 이슈 항목 코드표
// =============================================

export const HRD_ISSUE_ITEMS_A: Record<number, string> = {
  1: '교육에 대한 성과 검증',
  2: '경영 성과 향상을 위한 HRD',
  3: '역량 중심의 교육',
  4: '스킬 중심의 교육',
  5: '진단평가 솔루션',
  6: '교육효과의 성과연계 및 인사 반영',
  7: '핵심인재/차세대 리더의 선발 및 육성',
  8: '조직 및 세대변화에 따른 새로운 리더십 스킬',
  9: '세대간 협업 촉진을 위한 교육',
  10: '조직에 대한 직원들의 소속감 강화',
  11: '직원들의 업무동기 강화, 업무 몰입 제고를 위한 마인드 확립',
  12: '직원들의 힐링, 회복탄력성 관리',
  13: '신입사원 온보딩/리텐션',
  14: '저성과자 교육',
  15: '은퇴설계 및 고령화로 인한 생애설계 프로그램',
}

export const HRD_ISSUE_ITEMS_B: Record<number, string> = {
  1: '조직문화와 핵심가치 내재화 교육',
  2: 'DEI(Diversity&Equity&Inclusion) 강화 교육',
  3: '데이터분석, 데이터 리터러시 교육',
  4: 'DT(AI) 활용 능력 강화',
  5: '직무교육 강화(직무전문가 육성)',
  6: 'CDP(경력개발 프로그램)',
  7: '잡크래프팅',
  8: '사내강사 확대',
  9: '대면 및 비대면 방식을 연계한 하이브리드 러닝',
  10: '워크플로우 러닝 (일과 학습의 결합)',
  11: '하이브리드 워크 관련 교육',
  12: '짧고 간결한 교육_마이크로러닝',
  13: '게임화, 시뮬레이션 등 흥미로운 학습 기법 도입',
  14: '실감형 교육(메타버스, VR&AR 등)',
  15: '학습 개인화 및 자동화(AI 기반)',
}
