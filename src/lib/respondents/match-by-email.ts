/**
 * 전화번호가 없을 때 이메일로 기존 응답자를 재사용할지 고른다 (T-073).
 *
 * 이메일은 공용·더미·오기입 값이 섞여 있어(예: 1123@hnsmall.com 을 두 회사 담당자가 공유) 이메일만으로
 * 같은 사람이라고 볼 수 없다. 같은 이메일 후보 중 **이름까지 같은** 응답자만 재사용하고, 없으면 null 을
 * 돌려 새 응답자를 만들게 한다. 이전에는 첫 후보를 재사용하면서 이름을 덮어써 다른 사람 기록이 오염됐다.
 */
export function pickSamePersonByEmail(
  candidates: { id: string; name: string | null }[],
  rowName: string
): string | null {
  const target = rowName.trim()
  if (!target) return null
  const same = candidates.find((c) => (c.name ?? '').trim() === target)
  return same ? same.id : null
}
