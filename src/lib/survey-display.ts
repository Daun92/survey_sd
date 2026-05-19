// 관리자 화면용 설문 표시명 헬퍼.
//
// 정책: edu_surveys.title 은 "공개용 공식 명칭" 으로 의미 고정.
// 관리자 화면에서는 보조 라벨(internal_label) 또는 session·course 메타로 자동 조합한
// 부제목을 함께 표시한다. 응답자 화면 (/s/[token], /d/[token]) 은 title 만 사용.

const EDUCATION_TYPE_LABEL: Record<string, string> = {
  classroom: "집체",
  remote: "원격",
  consulting: "컨설팅",
  blended: "혼합",
  s2_edu_post: "교육후",
  cs: "CS",
  content_dev: "콘텐츠개발",
  smart: "스마트훈련",
  hrm: "HRM",
  hr_consulting: "HR컨설팅",
};

export function educationTypeLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return EDUCATION_TYPE_LABEL[code] ?? code;
}

export interface SurveyDisplayMeta {
  internal_label?: string | null;
  start_date?: string | null;       // 우선순위: sessions.start_date → surveys.starts_at
  education_type?: string | null;
  session_name?: string | null;
  session_number?: number | null;
}

/**
 * 관리자 화면 부제목 자동 조합.
 *  1) internal_label 가 있으면 그대로
 *  2) 없으면 [N월] · [education_type 한글] · [session_name 또는 N차]
 * 모든 항목이 비어 있으면 null.
 */
export function composeSurveySubtitle(meta: SurveyDisplayMeta): string | null {
  if (meta.internal_label?.trim()) return meta.internal_label.trim();
  const parts: string[] = [];
  if (meta.start_date) {
    const d = new Date(meta.start_date);
    if (!Number.isNaN(d.getTime())) parts.push(`${d.getMonth() + 1}월`);
  }
  const eduLabel = educationTypeLabel(meta.education_type);
  if (eduLabel) parts.push(eduLabel);
  if (meta.session_name) parts.push(meta.session_name);
  else if (meta.session_number != null) parts.push(`${meta.session_number}차`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
