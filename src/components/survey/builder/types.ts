export interface BuilderQuestion {
  id: number;
  questionOrder: number;
  questionText: string;
  questionType: string;
  category: string | null;
  isRequired: boolean;
  optionsJson: string | null;
}

export interface BuilderSurvey {
  id: number;
  title: string;
  surveyYear: number;
  surveyMonth: number;
  status: string;
  showProjectName: boolean;
  internalLabel: string | null;
  description: string | null;
  serviceType: { id: number; name: string };
  questions: BuilderQuestion[];
  _count: { distributions: number; responses: number };
}

export const QUESTION_TYPES = [
  { value: "rating_5", label: "5점 척도" },
  { value: "rating_10", label: "10점 척도" },
  { value: "likert_5", label: "리커트 5점" },
  { value: "likert_7", label: "리커트 7점" },
  { value: "single_choice", label: "단일 선택" },
  { value: "multi_choice", label: "복수 선택" },
  { value: "text", label: "주관식" },
  { value: "yes_no", label: "예/아니오" },
] as const;

export const CATEGORIES = [
  "교육내용",
  "강사",
  "운영",
  "전반적만족도",
  "주관식",
  "콘텐츠",
  "LMS",
  "기술지원",
  "결과보고",
  "커뮤니케이션",
  "전문성",
  "플랫폼",
  "성과",
] as const;

export const CHOICE_TYPES = new Set(["single_choice", "multi_choice", "multiple_choice"]);

export function isChoiceType(type: string): boolean {
  return CHOICE_TYPES.has(type);
}

export function typeLabel(type: string): string {
  return QUESTION_TYPES.find((t) => t.value === type)?.label ?? type;
}

export const EDITABLE_STATUSES = new Set(["draft"]);

export function isLockedStatus(status: string): boolean {
  return !EDITABLE_STATUSES.has(status);
}
