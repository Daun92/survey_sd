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
