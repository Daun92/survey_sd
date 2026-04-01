import nodemailer from 'nodemailer'
import type { EmailSendRequest, EmailResult, EmailSender, EmailProviderConfig } from './types'
import { createAdminClient } from '@/lib/supabase/admin'

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

// ─── SMTP 발송기 (Gmail, Outlook, 커스텀 SMTP) ───

class SmtpEmailSender implements EmailSender {
  private transporter: nodemailer.Transporter
  private fromAddress: string
  private fromName: string

  constructor(config: {
    host: string
    port: number
    secure: boolean
    user: string
    password: string
    fromEmail?: string
    fromName?: string
  }) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    })
    this.fromAddress = config.fromEmail || config.user
    this.fromName = config.fromName || ''
  }

  async send(req: EmailSendRequest): Promise<EmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromName
          ? `"${this.fromName}" <${this.fromAddress}>`
          : this.fromAddress,
        to: req.toName ? `"${req.toName}" <${req.to}>` : req.to,
        subject: req.subject,
        html: req.bodyHtml,
      })

      return { success: true, messageId: info.messageId }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'SMTP 발송 실패',
      }
    }
  }
}

// ─── SMTP 프리셋 ───

const SMTP_PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false },
}

// ─── 환경변수 기반 체크 (하위 호환) ───
export function isEmailConfigured(): boolean {
  return !!(process.env.HIWORKS_OFFICE_TOKEN && process.env.HIWORKS_USER_ID)
}

// ─── DB에서 제공자 설정으로 발송기 생성 ───
export function createSenderFromConfig(config: EmailProviderConfig): EmailSender {
  if (config.provider_type === 'hiworks') {
    if (!config.api_token || !config.api_user_id) {
      return new MockEmailSender()
    }
    return new HiWorksEmailSender(config.api_token, config.api_user_id)
  }

  // smtp, gmail, outlook
  const preset = SMTP_PRESETS[config.provider_type]
  const host = config.smtp_host || preset?.host
  const port = config.smtp_port || preset?.port || 587
  const secure = config.smtp_secure ?? preset?.secure ?? false

  if (!host || !config.smtp_user || !config.smtp_password) {
    return new MockEmailSender()
  }

  return new SmtpEmailSender({
    host,
    port,
    secure,
    user: config.smtp_user,
    password: config.smtp_password,
    fromEmail: config.from_email || undefined,
    fromName: config.from_name || undefined,
  })
}

// ─── DB 기반 팩토리 (기본 제공자 조회) ───
export async function getEmailSenderFromDB(): Promise<EmailSender> {
  try {
    const supabase = createAdminClient()
    const { data: provider } = await supabase
      .from('email_providers')
      .select('*')
      .eq('is_default', true)
      .limit(1)
      .single()

    if (provider) {
      return createSenderFromConfig(provider as EmailProviderConfig)
    }
  } catch {
    // DB 조회 실패 시 환경변수 폴백
  }

  return getEmailSender()
}

// ─── 환경변수 기반 팩토리 (하위 호환) ───
export function getEmailSender(): EmailSender {
  const officeToken = process.env.HIWORKS_OFFICE_TOKEN
  const userId = process.env.HIWORKS_USER_ID

  if (officeToken && userId) {
    return new HiWorksEmailSender(officeToken, userId)
  }

  console.warn('[Email] HIWORKS_OFFICE_TOKEN 또는 HIWORKS_USER_ID 미설정 → Mock 발송기 사용')
  return new MockEmailSender()
}
