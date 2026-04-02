import type { SmsSendRequest, SmsResult, SmsSender, SmsProviderConfig } from './types'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Mock 발송기 (개발/테스트용) ───
class MockSmsSender implements SmsSender {
  readonly isMock = true

  async send(req: SmsSendRequest): Promise<SmsResult> {
    console.log(`[MockSMS] To: ${req.toName ?? ''} <${req.to}>`)
    console.log(`[MockSMS] Type: ${req.messageType}`)
    console.log(`[MockSMS] Body: ${req.body.slice(0, 100)}${req.body.length > 100 ? '...' : ''}`)
    return { success: true, messageId: `mock-sms-${Date.now()}` }
  }
}

// ─── Aligo 발송기 ───
// API: POST https://apis.aligo.in/send/ (form-data)
// 문서: https://smartsms.aligo.in/admin/api/spec.html

class AligoSmsSender implements SmsSender {
  private apiKey: string
  private userId: string
  private senderPhone: string

  constructor(apiKey: string, userId: string, senderPhone: string) {
    this.apiKey = apiKey
    this.userId = userId
    this.senderPhone = senderPhone
  }

  async send(req: SmsSendRequest): Promise<SmsResult> {
    const formData = new FormData()
    formData.append('key', this.apiKey)
    formData.append('user_id', this.userId)
    formData.append('sender', req.from || this.senderPhone)
    formData.append('receiver', req.to)
    formData.append('msg', req.body)
    formData.append('msg_type', req.messageType)
    if (req.toName) {
      formData.append('receiver_name', req.toName)
    }

    try {
      const res = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json() as {
        result_code: number
        message: string
        msg_id?: string
        success_cnt?: number
        error_cnt?: number
      }

      if (data.result_code === 1 && (data.success_cnt ?? 0) > 0) {
        return {
          success: true,
          messageId: data.msg_id ?? `aligo-${Date.now()}`,
        }
      }

      return {
        success: false,
        error: data.message || `Aligo 응답 코드: ${data.result_code}`,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Aligo API 호출 실패',
      }
    }
  }
}

// ─── 뿌리오 발송기 ───
// API: https://message.ppurio.com
// 문서: https://www.ppurio.com/send-api/develop

const PPURIO_BASE_URL = 'https://message.ppurio.com'

class PpurioSmsSender implements SmsSender {
  private account: string
  private token: string
  private defaultSenderPhone: string
  private cachedAccessToken: string | null = null
  private tokenExpiry: number = 0  // Unix timestamp (ms)

  constructor(account: string, token: string, senderPhone: string) {
    this.account = account
    this.token = token
    this.defaultSenderPhone = senderPhone
  }

  /** 액세스 토큰 발급 (24시간 유효, 만료 5분 전 갱신) */
  private async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && Date.now() < this.tokenExpiry - 5 * 60 * 1000) {
      return this.cachedAccessToken
    }

    const credentials = Buffer.from(`${this.account}:${this.token}`).toString('base64')

    const res = await fetch(`${PPURIO_BASE_URL}/v1/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    })

    if (!res.ok) {
      throw new Error(`뿌리오 토큰 발급 실패: HTTP ${res.status}`)
    }

    const data = await res.json() as { token: string }

    if (!data.token) {
      throw new Error('뿌리오 토큰 응답에 token 필드 없음')
    }

    this.cachedAccessToken = data.token
    // 토큰 유효기간 24시간
    this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000

    return this.cachedAccessToken
  }

  async send(req: SmsSendRequest): Promise<SmsResult> {
    try {
      const accessToken = await this.getAccessToken()
      const senderPhone = req.from || this.defaultSenderPhone

      const body = {
        account: this.account,
        messageType: req.messageType,
        content: req.body,
        from: senderPhone,
        duplicateFlag: 'N',
        targetCount: 1,
        targets: [
          {
            to: req.to,
            ...(req.toName ? { name: req.toName } : {}),
          },
        ],
      }

      const res = await fetch(`${PPURIO_BASE_URL}/v1/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        return {
          success: false,
          error: `뿌리오 발송 실패: HTTP ${res.status} ${JSON.stringify(errData)}`,
        }
      }

      const data = await res.json() as {
        messageKey?: string
      }

      return {
        success: true,
        messageId: data.messageKey ?? `ppurio-${Date.now()}`,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : '뿌리오 API 호출 실패',
      }
    }
  }
}

// ─── DB에서 제공자 설정으로 발송기 생성 ───
export function createSmsFromConfig(config: SmsProviderConfig): SmsSender {
  if (config.provider_type === 'aligo') {
    if (!config.api_key || !config.api_user_id || !config.sender_phone) {
      return new MockSmsSender()
    }
    return new AligoSmsSender(config.api_key, config.api_user_id, config.sender_phone)
  }

  if (config.provider_type === 'ppurio') {
    if (!config.api_key || !config.api_user_id || !config.sender_phone) {
      return new MockSmsSender()
    }
    return new PpurioSmsSender(config.api_user_id, config.api_key, config.sender_phone)
  }

  // naver_cloud, twilio 등 추후 확장
  console.warn(`[SMS] 미지원 프로바이더: ${config.provider_type} → Mock 발송기 사용`)
  return new MockSmsSender()
}

// ─── DB 기반 팩토리 (기본 프로바이더 조회) ───
export async function getSmsSenderFromDB(): Promise<SmsSender> {
  try {
    const supabase = createAdminClient()
    const { data: provider } = await supabase
      .from('sms_providers')
      .select('*')
      .eq('is_default', true)
      .limit(1)
      .single()

    if (provider) {
      return createSmsFromConfig(provider as SmsProviderConfig)
    }
  } catch {
    // DB 조회 실패 시 환경변수 폴백
  }

  return getSmsSender()
}

// ─── 환경변수 기반 팩토리 (하위 호환) ───
export function getSmsSender(): SmsSender {
  // 1. 뿌리오 환경변수 우선
  const ppurioUser = process.env.PPURIO_USERNAME
  const ppurioToken = process.env.PPURIO_TOKEN
  const ppurioSender = process.env.PPURIO_SENDER_PHONE

  if (ppurioUser && ppurioToken && ppurioSender) {
    return new PpurioSmsSender(ppurioUser, ppurioToken, ppurioSender)
  }

  // 2. Aligo 폴백
  const apiKey = process.env.ALIGO_API_KEY
  const userId = process.env.ALIGO_USER_ID
  const senderPhone = process.env.ALIGO_SENDER_PHONE

  if (apiKey && userId && senderPhone) {
    return new AligoSmsSender(apiKey, userId, senderPhone)
  }

  console.warn('[SMS] PPURIO 또는 ALIGO 환경변수 미설정 → Mock 발송기 사용')
  return new MockSmsSender()
}
