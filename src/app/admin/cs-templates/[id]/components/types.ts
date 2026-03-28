// ─── CS Template Editor Types ───
// 공유 타입은 설문 에디터에서 re-export

export {
  type SurveySettings,
  type SectionIntro,
  type RespondentFieldConfig,
  RESPONDENT_FIELD_PRESETS,
  type PanelMode,
  type PreviewTab,
  likertLabels,
} from "@/app/admin/surveys/[id]/components/types";

export interface SkipLogic {
  show_when: {
    question_id: string;
    operator: "equals" | "not_equals" | "greater_than" | "less_than";
    value: string | number;
  };
}

// CS 템플릿 전용 문항 타입
export interface CSQuestion {
  id: string;
  template_id: string;
  question_no: string;
  question_text: string;
  question_type: string;
  page_type: string | null;
  response_options: string | null;
  section_label: string | null;
  sort_order: number;
  is_required?: boolean;
  skip_logic?: SkipLogic | null;
  metadata?: Record<string, unknown> | null;
}

// CS 템플릿 타입
export interface CSTemplate {
  id: string;
  division: string;
  division_label: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  settings?: Record<string, unknown> | null;
  created_at: string;
}

// CS 전용 문항 유형
export const csQuestionTypeOptions = [
  { value: "likert_5", label: "5점 척도" },
  { value: "likert_6", label: "6점 척도" },
  { value: "likert_7", label: "7점 척도" },
  { value: "single_choice", label: "단일선택" },
  { value: "multiple_choice", label: "복수선택" },
  { value: "text", label: "주관식" },
  { value: "rating", label: "평점" },
  { value: "yes_no", label: "예/아니오" },
];

export const csQuestionTypeLabels: Record<string, string> = {
  single_choice: "단일선택",
  multiple_choice: "복수선택",
  likert_5: "5점 척도",
  likert_6: "6점 척도",
  likert_7: "7점 척도",
  text: "주관식",
  rating: "평점",
  yes_no: "예/아니오",
};

// response_options는 "/" 구분 문자열
export function parseResponseOptions(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split("/").map((s) => s.trim()).filter(Boolean);
}

export function groupQuestionsBySectionLabel(questions: CSQuestion[]) {
  const sections: Record<string, CSQuestion[]> = {};
  questions.forEach((q) => {
    const section = q.section_label || "기타";
    if (!sections[section]) sections[section] = [];
    sections[section].push(q);
  });
  return Object.entries(sections);
}
