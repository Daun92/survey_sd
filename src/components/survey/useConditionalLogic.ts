/**
 * useConditionalLogic — 조건부 표시 로직 통합 훅
 *
 * /s/ 폼의 shouldShowQuestion (4 연산자)과
 * /hrd/ 폼의 shouldShowItem (6 연산자)를 통합.
 * 두 형식 모두 지원합니다.
 */

/** EDU 폼의 skip_logic 형식 */
interface EduSkipLogic {
  show_when?: {
    question_id: string;
    operator: "equals" | "not_equals" | "greater_than" | "less_than";
    value: string | number;
  };
}

/** HRD 폼의 show_if 형식 */
interface HrdShowIf {
  question_id: string;
  operator: "eq" | "neq" | "gt" | "lt" | "in" | "not_in";
  value: string | number | (string | number)[];
}

type Answers = Record<string, unknown>;

/**
 * EDU 설문 조건부 표시 평가
 * skip_logic?.show_when 형식
 */
export function evaluateEduCondition(
  skipLogic: EduSkipLogic | null | undefined,
  answers: Answers
): boolean {
  if (!skipLogic?.show_when) return true;

  const { question_id, operator, value } = skipLogic.show_when;
  const answer = answers[question_id];
  if (answer === undefined || answer === null) return false;

  const numAnswer = Number(answer);
  const numValue = Number(value);

  switch (operator) {
    case "equals":
      return String(answer) === String(value);
    case "not_equals":
      return String(answer) !== String(value);
    case "greater_than":
      return !isNaN(numAnswer) && !isNaN(numValue) && numAnswer > numValue;
    case "less_than":
      return !isNaN(numAnswer) && !isNaN(numValue) && numAnswer < numValue;
    default:
      return true;
  }
}

/**
 * HRD 설문 조건부 표시 평가
 * show_if 형식 (확장 연산자 포함)
 */
export function evaluateHrdCondition(
  showIf: HrdShowIf | null | undefined,
  answers: Answers
): boolean {
  if (!showIf) return true;

  const { question_id, operator, value } = showIf;
  const answer = answers[question_id];
  if (answer === undefined || answer === null) return false;

  const numAnswer = Number(answer);
  const numValue = Number(value);

  switch (operator) {
    case "eq":
      return String(answer) === String(value);
    case "neq":
      return String(answer) !== String(value);
    case "gt":
      return !isNaN(numAnswer) && !isNaN(numValue) && numAnswer > numValue;
    case "lt":
      return !isNaN(numAnswer) && !isNaN(numValue) && numAnswer < numValue;
    case "in":
      return Array.isArray(value) && value.map(String).includes(String(answer));
    case "not_in":
      return Array.isArray(value) && !value.map(String).includes(String(answer));
    default:
      return true;
  }
}

/**
 * 섹션/파트 내 필수 문항 유효성 검증
 *
 * 3개 폼의 validateCurrentSection 로직(75% 중복)을 통합.
 */
export function validateVisibleRequired<
  T extends { id: string; is_required?: boolean; isRequired?: boolean }
>(
  questions: T[],
  answers: Answers,
  isVisible: (q: T) => boolean
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const q of questions) {
    const required = q.is_required ?? q.isRequired ?? false;
    if (!required) continue;
    if (!isVisible(q)) continue;

    const answer = answers[q.id];
    if (answer === undefined || answer === null || answer === "") {
      errors[q.id] = "필수 문항입니다";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
