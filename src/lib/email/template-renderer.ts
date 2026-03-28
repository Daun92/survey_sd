// ─── 템플릿 변수 치환 ───

/**
 * HTML 템플릿 내 {변수명} 패턴을 실제 값으로 치환
 */
export function renderTemplate(
  html: string,
  variables: Record<string, string>
): string {
  return html.replace(/\{([^}]+)\}/g, (match, key) => {
    return variables[key] ?? match
  })
}

/**
 * 배포/설문/응답자 데이터에서 템플릿 변수 맵 생성
 */
export function getTemplateVariables(params: {
  recipientName?: string
  companyName?: string
  courseName?: string
  surveyLink: string
  educationEndDate?: string
}): Record<string, string> {
  return {
    담당자명: params.recipientName || '담당자',
    회사명: params.companyName || '',
    과정명: params.courseName || '',
    설문링크: params.surveyLink,
    교육종료일: params.educationEndDate || '',
  }
}
