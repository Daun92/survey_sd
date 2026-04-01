// ─── SMS 발송 인터페이스 ───

export interface SmsSendRequest {
  to: string          // 수신 전화번호
  toName?: string
  body: string        // 메시지 본문 (plain text)
  messageType: 'SMS' | 'LMS'
}

export interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface SmsSender {
  readonly isMock?: boolean
  send(req: SmsSendRequest): Promise<SmsResult>
}

// ─── SMS 프로바이더 설정 ───

export type SmsProviderType = 'aligo' | 'naver_cloud' | 'twilio'

export interface SmsProviderConfig {
  id: string
  name: string
  provider_type: SmsProviderType
  api_key: string | null
  api_user_id: string | null
  sender_phone: string | null
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}
