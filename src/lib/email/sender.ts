import type { EmailSendRequest, EmailResult, EmailSender } from './types'

// ─── Mock 발송기 (개발/테스트용) ───
class MockEmailSender implements EmailSender {
  readonly isMock = true

  async send(req: EmailSendRequest): Promise<EmailResult> {
    console.log(`[MockEmail] To: ${req.toName} <${req.to}>`)
    console.log(`[MockEmail] Subject: ${req.subject}`)
    console.log(`[MockEmail] Body length: ${req.bodyHtml.length} chars`)
    return { success: true, messageId: `mock-${Date.now()}` }
  }
}

// ─── HiWorks 발송기 ───
// 환경변수: HIWORKS_OFFICE_TOKEN, HIWORKS_USER_ID
// API: POST https://api.hiworks.com/office/v2/webmail/sendMail (form-data)
// 일일 한도: officeToken당 최대 1,000건/일

class HiWorksEmailSender implements EmailSender {
  private officeToken: string
  private userId: string

  constructor(officeToken: string, userId: string) {
    this.officeToken = officeToken
    this.userId = userId
  }

  async send(req: EmailSendRequest): Promise<EmailResult> {
    const formData = new FormData()
    formData.append('to', req.to)
    formData.append('user_id', this.userId)
    formData.append('subject', req.subject)
    formData.append('content', req.bodyHtml)
    formData.append('save_sent_mail', 'Y')

    try {
      const res = await fetch('https://api.hiworks.com/office/v2/webmail/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.officeToken}`,
        },
        body: formData,
      })

      const data = await res.json() as {
        code: string
        message: string
        result?: {
          successList: string[]
          dupList: string[]
          wrongList: string[]
        }
      }

      if (data.code === 'SUC' && data.result?.successList?.includes(req.to)) {
        return { success: true, messageId: `hiworks-${Date.now()}` }
      }

      // wrongList에 포함된 경우
      if (data.result?.wrongList?.includes(req.to)) {
        return { success: false, error: `잘못된 메일 주소: ${req.to}` }
      }

      return {
        success: false,
        error: data.message || `HiWorks 응답 코드: ${data.code}`,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'HiWorks API 호출 실패',
      }
    }
  }
}

// ─── 환경변수 체크 ───
export function isEmailConfigured(): boolean {
  return !!(process.env.HIWORKS_OFFICE_TOKEN && process.env.HIWORKS_USER_ID)
}

// ─── 팩토리 ───
export function getEmailSender(): EmailSender {
  const officeToken = process.env.HIWORKS_OFFICE_TOKEN
  const userId = process.env.HIWORKS_USER_ID

  if (officeToken && userId) {
    return new HiWorksEmailSender(officeToken, userId)
  }

  console.warn('[Email] HIWORKS_OFFICE_TOKEN 또는 HIWORKS_USER_ID 미설정 → Mock 발송기 사용')
  return new MockEmailSender()
}
