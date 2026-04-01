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
    formData.append('sender', this.senderPhone)
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

// ─── DB에서 제공자 설정으로 발송기 생성 ───
export function createSmsFromConfig(config: SmsProviderConfig): SmsSender {
  if (config.provider_type === 'aligo') {
    if (!config.api_key || !config.api_user_id || !config.sender_phone) {
      return new MockSmsSender()
    }
    return new AligoSmsSender(config.api_key, config.api_user_id, config.sender_phone)
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
  const apiKey = process.env.ALIGO_API_KEY
  const userId = process.env.ALIGO_USER_ID
  const senderPhone = process.env.ALIGO_SENDER_PHONE

  if (apiKey && userId && senderPhone) {
    return new AligoSmsSender(apiKey, userId, senderPhone)
  }

  console.warn('[SMS] ALIGO_API_KEY/USER_ID/SENDER_PHONE 미설정 → Mock 발송기 사용')
  return new MockSmsSender()
}
