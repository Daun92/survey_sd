import { AlertTriangle } from 'lucide-react'
import { getPhoneWarning, PHONE_HEADER_NAMES, type ParsedRow } from '@/lib/csv/parse-distribution-csv'

/**
 * 업로드 미리보기에서 전화번호가 빠진 행을 알린다 (T-073).
 * 번호 없이 만든 발송은 문자 발송이 안 되고, CS 대상자 설문이력(휴대번호 매칭) 판정에서 빠진다.
 */
export function PhoneWarningBanner({ rows }: { rows: ParsedRow[] }) {
  const w = getPhoneWarning(rows)
  if (w.level === 'none') return null

  const headers = PHONE_HEADER_NAMES.map((h) => `'${h}'`).join('·')
  return (
    <div className="flex items-start gap-2 mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      <div>
        {w.level === 'all' ? (
          <>
            <strong>전화번호 열을 찾지 못했습니다.</strong> 열 이름을 {headers} 중 하나로 맞춰 주세요.
          </>
        ) : (
          <>
            <strong>{w.missing}명</strong>(전체 {w.total}명)의 전화번호가 비어 있습니다.
          </>
        )}
        <span className="block text-xs text-amber-700 mt-0.5">
          번호 없이 만들면 문자 발송이 안 되고, 설문이력 판정에서 빠져 다음 대상자 선정 때 다시 뽑힐 수 있습니다.
        </span>
      </div>
    </div>
  )
}
