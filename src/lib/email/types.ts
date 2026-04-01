// ─── 메일 발송 인터페이스 ───

export interface EmailSendRequest {
  to: string
  toName?: string
  subject: string
  bodyHtml: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface EmailSender {
  readonly isMock?: boolean
  send(req: EmailSendRequest): Promise<EmailResult>
}

// ─── 이메일 제공자 설정 ───

export type EmailProviderType = 'hiworks' | 'smtp' | 'gmail' | 'outlook'

export interface EmailProviderConfig {
  id: string
  name: string
  provider_type: EmailProviderType
  smtp_host: string | null
  smtp_port: number | null
  smtp_secure: boolean | null
  smtp_user: string | null
  smtp_password: string | null
  api_token: string | null
  api_user_id: string | null
  from_name: string | null
  from_email: string | null
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}
