import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Vercel serverless 런타임은 UTC 라 d.getHours() 가 UTC 시각을 리턴.
// 관리자 화면은 한국 운영팀이 사용하므로 KST 로 고정 포맷.
const KST_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function getKstParts(d: Date): Record<string, string> {
  const parts = KST_PARTS.formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  // Node Intl 이 자정에 'hour: 24' 를 리턴하는 엣지 케이스 방어
  if (m.hour === "24") m.hour = "00";
  return m;
}

/**
 * 날짜를 yyyy.MM.dd (KST) 로 포맷. null 안전.
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const p = getKstParts(d);
  return `${p.year}.${p.month}.${p.day}`;
}

/**
 * 날짜+시간을 yyyy.MM.dd HH:mm (KST) 로 포맷. null 안전.
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const p = getKstParts(d);
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}
