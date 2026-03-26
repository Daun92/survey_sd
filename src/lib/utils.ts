export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function generateSurveyUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/s/${token}`
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'in_progress':
    case 'completed':
      return 'bg-emerald-100 text-emerald-800'
    case 'draft':
    case 'scheduled':
      return 'bg-slate-100 text-slate-800'
    case 'paused':
      return 'bg-amber-100 text-amber-800'
    case 'closed':
    case 'cancelled':
    case 'archived':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: '초안',
    active: '진행중',
    paused: '일시정지',
    closed: '마감',
    archived: '보관',
    scheduled: '예정',
    in_progress: '진행중',
    completed: '완료',
    cancelled: '취소',
  }
  return labels[status] || status
}

export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
}
