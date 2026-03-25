// Database types for EXC-Survey Platform

export type UserRole = 'admin' | 'manager' | 'im' | 'cs' | 'am' | 'consulting' | 'marketing' | 'viewer'

export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived'
export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type SurveyStatus = 'draft' | 'active' | 'paused' | 'closed' | 'archived'
export type EducationType = 'classroom' | 'remote' | 'consulting' | 'recruitment' | 'public'
export type SurveyType = 's1_cs' | 's2_edu_post' | 's3_instructor' | 's4_needs' | 's4b_pre' | 's5_internal' | 's7_market'
export type QuestionType = 'likert_5' | 'likert_7' | 'single_choice' | 'multiple_choice' | 'text' | 'number' | 'rating'
export type Channel = 'online' | 'phone' | 'paper'

export interface UserProfile {
  id: string
  email: string
  name: string
  role: UserRole
  team?: string
  department?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  industry?: string
  size?: string
  bris_code?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  organization_id?: string
  organization?: Organization
  name: string
  bris_code?: string
  project_type: string
  status: ProjectStatus
  am_id?: string
  am?: UserProfile
  start_date?: string
  end_date?: string
  notes?: string
  created_at: string
  updated_at: string
  courses?: Course[]
}

export interface Course {
  id: string
  project_id: string
  name: string
  education_type: EducationType
  description?: string
  target_audience?: string
  total_hours?: number
  created_at: string
  updated_at: string
  sessions?: Session[]
}

export interface Session {
  id: string
  course_id: string
  session_number: number
  name?: string
  location?: string
  region?: string
  start_date?: string
  end_date?: string
  total_hours?: number
  capacity?: number
  im_id?: string
  status: SessionStatus
  created_at: string
  updated_at: string
  class_groups?: ClassGroup[]
  course?: Course
}

export interface ClassGroup {
  id: string
  session_id: string
  name: string
  survey_url_token: string
  capacity?: number
  notes?: string
  created_at: string
}

export interface Instructor {
  id: string
  name: string
  specialty?: string
  email?: string
  phone?: string
  is_active: boolean
  created_at: string
}

export interface SurveyTemplate {
  id: string
  survey_type: SurveyType
  education_type: EducationType
  name: string
  description?: string
  question_config: QuestionConfig[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface QuestionConfig {
  section: string
  question_code: string
  question_text: string
  question_type: QuestionType
  is_required: boolean
  options?: QuestionOption[]
  metadata?: Record<string, unknown>
}

export interface QuestionOption {
  value: number | string
  label: string
}

export interface Survey {
  id: string
  template_id?: string
  session_id?: string
  project_id?: string
  title: string
  description?: string
  survey_type: SurveyType
  education_type: EducationType
  status: SurveyStatus
  url_token: string
  settings: SurveySettings
  starts_at?: string
  ends_at?: string
  created_by?: string
  created_at: string
  updated_at: string
  questions?: Question[]
  session?: Session
}

export interface SurveySettings {
  anonymous?: boolean
  allow_edit?: boolean
  collect_respondent_info?: boolean
  show_progress?: boolean
  thank_you_message?: string
}

export interface Question {
  id: string
  survey_id: string
  section: string
  question_code: string
  question_text: string
  question_type: QuestionType
  is_required: boolean
  sort_order: number
  options?: QuestionOption[]
  metadata?: Record<string, unknown>
  created_at: string
}

export interface Submission {
  id: string
  survey_id: string
  session_id?: string
  class_group_id?: string
  respondent_name?: string
  respondent_department?: string
  respondent_position?: string
  respondent_email?: string
  answers: Record<string, number | string>
  channel: Channel
  is_complete: boolean
  submitted_at: string
  created_at: string
}

// View types
export interface SessionSurveyStats {
  survey_id: string
  title: string
  session_id: string
  session_name: string
  capacity: number
  response_count: number
  complete_count: number
  response_rate: number
}

// Likert scale labels
export const LIKERT_5_OPTIONS: QuestionOption[] = [
  { value: 1, label: '매우 불만족' },
  { value: 2, label: '불만족' },
  { value: 3, label: '보통' },
  { value: 4, label: '만족' },
  { value: 5, label: '매우 만족' },
]
