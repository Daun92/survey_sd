// 이메일과 동일한 변수 치환 로직 재사용
export { renderTemplate, getTemplateVariables } from '@/lib/email/template-renderer'

/**
 * EUC-KR 기준 바이트 길이 계산
 * 한글/한자/전각문자: 2바이트, ASCII: 1바이트
 */
export function getSmsByteLength(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    // ASCII (0x00~0x7F): 1바이트
    // 한글, 한자, 전각 등: 2바이트
    bytes += code > 0x7F ? 2 : 1
  }
  return bytes
}

/**
 * 바이트 길이 기반 SMS/LMS 자동 판별
 * SMS: 90바이트 이하 (한글 약 45자)
 * LMS: 90바이트 초과 ~ 2000바이트 (한글 약 1000자)
 */
export function getSmsMessageType(text: string): 'SMS' | 'LMS' {
  return getSmsByteLength(text) <= 90 ? 'SMS' : 'LMS'
}
