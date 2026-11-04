/**
 * 응답자 전화번호 키 (T-073).
 *
 * respondents.phone 에는 숫자만('01022305532')과 하이픈('010-2230-5532') 형식이 섞여 있고,
 * 중복 방지는 DB unique index respondents_phone_norm_key(fn_cs_norm_phone(phone)) 가 맡는다.
 * 원문 문자열로 .eq("phone", …) 하면 형식이 다른 같은 번호를 못 찾고, 새로 넣다가 그 index 에 막힌다.
 */

/** DB fn_cs_norm_phone 과 같은 규칙: 숫자만 → 82 로 시작하면 0 으로 → 10자리·1 로 시작하면 앞에 0 복원 */
export function normPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[^0-9]/g, "")
  if (!digits) return null
  if (digits.startsWith("82")) return "0" + digits.slice(2)
  if (digits.length === 10 && digits.startsWith("1")) return "0" + digits
  return digits
}

/** 같은 번호로 저장됐을 수 있는 문자열들 — .in("phone", keys) 조회용 */
export function phoneLookupKeys(raw: string | null | undefined): string[] {
  const n = normPhone(raw)
  if (!n) return []

  const dashed: string[] = []
  if (n.startsWith("02")) {
    if (n.length === 9) dashed.push(`${n.slice(0, 2)}-${n.slice(2, 5)}-${n.slice(5)}`)
    if (n.length === 10) dashed.push(`${n.slice(0, 2)}-${n.slice(2, 6)}-${n.slice(6)}`)
  } else {
    if (n.length === 10) dashed.push(`${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`)
    if (n.length === 11) dashed.push(`${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`)
  }

  const rawDigits = (raw ?? "").replace(/[^0-9]/g, "")
  return [...new Set([n, ...dashed, rawDigits, (raw ?? "").trim()].filter(Boolean))]
}
