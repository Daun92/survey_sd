// ─── Shared Types & Constants for Survey Editor ───

export interface RespondentFieldConfig {
  id: string;
  label: string;
  enabled: boolean;
  required: boolean;
}

export const RESPONDENT_FIELD_PRESETS: RespondentFieldConfig[] = [
  { id: "name", label: "이름", enabled: true, required: false },
  { id: "department", label: "소속", enabled: true, required: false },
  { id: "position", label: "직책", enabled: false, required: false },
  { id: "phone", label: "연락처", enabled: false, required: false },
  { id: "email", label: "이메일", enabled: false, required: false },
];

export interface SectionIntro {
  title?: string;
  description?: string;
  color?: "neutral" | "brand" | "warm" | "cool" | "teal" | "blue" | "amber" | "rose" | "violet" | "green" | "transparent";
  image_url?: string;
  image_size?: "full" | "medium" | "small" | "original";
}

export interface SurveySettings {
  collect_respondent_info?: boolean;
  anonymous?: boolean;
  show_progress?: boolean;
  thank_you_message?: string;
  landing_notice?: string;
  ending_title?: string;
  welcome_message?: string;
  privacy_consent_text?: string;
  require_consent?: boolean;
  hero_image_url?: string;
  show_meta_info?: boolean;
  show_ending_stats?: boolean;
  respondent_fields?: RespondentFieldConfig[];
  section_intros?: Record<string, SectionIntro>;
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: string;
  survey_type: string;
  education_type: string;
  starts_at: string | null;
  ends_at: string | null;
  url_token: string;
  settings?: SurveySettings | null;
}

export interface SkipLogic {
  show_when: {
    question_id: string;
    operator: "equals" | "not_equals" | "greater_than" | "less_than";
    value: string | number;
  };
}

export interface Question {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: string;
  question_code: string | null;
  section: string | null;
  is_required: boolean;
  sort_order: number;
  options: string[] | string | null;
  skip_logic?: SkipLogic | null;
}

export interface EditorProps {
  survey: Survey;
  questions: Question[];
  submissionCount: number;
}

export type PanelMode = "preview" | "edit" | "add" | "section_edit";
export type PreviewTab = "landing" | "questions" | "ending";

// ─── Constants ───

export const statusOptions = [
  { value: "draft", label: "초안" },
  { value: "active", label: "진행중" },
  { value: "closed", label: "마감" },
];

export const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
  draft: { label: "초안", className: "border border-stone-200 text-stone-700 bg-white" },
};

export const questionTypeOptions = [
  { value: "likert_5", label: "리커트 5점" },
  { value: "likert_7", label: "리커트 7점" },
  { value: "multiple_choice", label: "객관식 (복수)" },
  { value: "single_choice", label: "객관식 (단일)" },
  { value: "text", label: "주관식" },
  { value: "rating", label: "평점" },
  { value: "yes_no", label: "예/아니오" },
  { value: "info_block", label: "안내 블록" },
];

export const questionTypeLabels: Record<string, string> = {
  likert_5: "리커트 5점",
  likert_7: "리커트 7점",
  text: "주관식",
  multiple_choice: "객관식 (복수)",
  single_choice: "객관식 (단일)",
  rating: "평점",
  yes_no: "예/아니오",
  info_block: "안내 블록",
};

export const likertLabels: Record<number, string> = {
  5: "매우 만족",
  4: "만족",
  3: "보통",
  2: "불만족",
  1: "매우 불만족",
};

// ─── Utils ───

export function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return "";
  return dateStr.slice(0, 10);
}

export function parseOptions(raw: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  }
}

export const needsOptions = (type: string) =>
  type === "multiple_choice" || type === "single_choice";

export function evaluateSkipLogic(
  skipLogic: SkipLogic | null | undefined,
  answers: Record<string, number | string>
): boolean {
  if (!skipLogic?.show_when) return true;
  const { question_id, operator, value } = skipLogic.show_when;
  const answer = answers[question_id];
  if (answer === undefined) return false;
  switch (operator) {
    case "equals": return String(answer) === String(value);
    case "not_equals": return String(answer) !== String(value);
    case "greater_than": return Number(answer) > Number(value);
    case "less_than": return Number(answer) < Number(value);
    default: return true;
  }
}

export function groupQuestionsBySection(questions: Question[]) {
  const sections: Record<string, Question[]> = {};
  questions.forEach((q) => {
    const section = q.section || "일반";
    if (!sections[section]) sections[section] = [];
    sections[section].push(q);
  });
  return Object.entries(sections);
}
