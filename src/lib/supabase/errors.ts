/**
 * Supabase/PostgREST 에러를 사용자·운영자 친화적인 형태로 분류한다.
 *
 * 사용 예:
 *   const { data, error } = await supabase.from('edu_surveys').select(...)
 *   if (error) throw supabaseError(error, '설문 목록을 불러올 수 없습니다')
 *
 * 또는 error.tsx 에서:
 *   const info = classifyError(error)
 *   render info.userMessage + info.operatorHint
 */

export type PostgrestErrorKind =
  | "no_rows"          // PGRST116
  | "schema_cache"     // PGRST002
  | "rls_denied"       // 42501
  | "timeout"          // 57014
  | "network"          // fetch 레벨 에러
  | "unknown";

export interface ClassifiedError {
  kind: PostgrestErrorKind;
  code: string | null;
  rawMessage: string;
  /** 사용자에게 보여줄 짧은 문장 */
  userMessage: string;
  /** 운영자·로그에 도움되는 추가 정보 */
  operatorHint: string;
}

interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export function classifyError(err: unknown): ClassifiedError {
  if (!err || typeof err !== "object") {
    return {
      kind: "unknown",
      code: null,
      rawMessage: String(err ?? ""),
      userMessage: "알 수 없는 오류가 발생했습니다.",
      operatorHint: "원본 에러 객체 없음",
    };
  }

  const e = err as PostgrestLikeError;
  const code = (e.code ?? null) as string | null;
  const rawMessage = e.message ?? "";

  if (code === "PGRST116") {
    return {
      kind: "no_rows",
      code,
      rawMessage,
      userMessage: "해당 항목을 찾을 수 없습니다.",
      operatorHint: "PGRST116: 쿼리 결과 0건 (또는 RLS 로 가려졌을 가능성)",
    };
  }
  if (code === "PGRST002") {
    return {
      kind: "schema_cache",
      code,
      rawMessage,
      userMessage: "일시적 DB 설정 이상이 발생했습니다. 잠시 후 다시 시도해 주세요.",
      operatorHint:
        "PGRST002: PostgREST schema cache 로드 실패. authenticator role 의 pgrst.db_schemas 가 존재하지 않는 스키마를 참조할 때 발생. `ALTER ROLE authenticator SET pgrst.db_schemas = '...'` 점검 + `NOTIFY pgrst, 'reload schema'`.",
    };
  }
  if (code === "42501") {
    return {
      kind: "rls_denied",
      code,
      rawMessage,
      userMessage: "이 데이터에 접근할 권한이 없습니다.",
      operatorHint: "42501: RLS 정책에 의해 거부됨. 로그인 계정의 user_roles / 정책 qual 확인.",
    };
  }
  if (code === "57014") {
    return {
      kind: "timeout",
      code,
      rawMessage,
      userMessage: "응답이 지연되어 작업을 중단했습니다. 잠시 후 다시 시도해 주세요.",
      operatorHint: "57014: statement_timeout 초과. 쿼리/인덱스 점검 필요.",
    };
  }

  if (rawMessage && /fetch|network|ECONNRESET|ETIMEDOUT/i.test(rawMessage)) {
    return {
      kind: "network",
      code,
      rawMessage,
      userMessage: "네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
      operatorHint: "Fetch 레벨 네트워크 에러 — Supabase 프로젝트 상태·DNS 점검.",
    };
  }

  return {
    kind: "unknown",
    code,
    rawMessage,
    userMessage: rawMessage || "데이터를 불러오지 못했습니다.",
    operatorHint: `code=${code ?? "?"} message=${rawMessage}`,
  };
}

/**
 * Supabase error 를 받아 즉시 throw 할 Error 객체를 만든다.
 * userMessage 뒤에 `[code]` 태그를 붙여 error.tsx 에서 kind 판별에 활용.
 */
export function supabaseError(err: unknown, fallback?: string): Error {
  const info = classifyError(err);
  const tag = info.code ? ` [${info.code}]` : "";
  const message = fallback && info.kind === "unknown" ? fallback + tag : info.userMessage + tag;
  const out = new Error(message);
  // operator hint 를 cause 로 남겨 서버 로그에 남기기
  (out as { cause?: unknown }).cause = { kind: info.kind, code: info.code, hint: info.operatorHint, raw: info.rawMessage };
  return out;
}

/**
 * error.tsx 의 error 객체(message 에 `[code]` 태그가 붙어 있음) 에서
 * kind 를 역추론한다.
 */
export function kindFromErrorMessage(message: string): PostgrestErrorKind {
  const m = message.match(/\[(PGRST\d+|\d{5})\]/);
  if (!m) return "unknown";
  const code = m[1];
  if (code === "PGRST116") return "no_rows";
  if (code === "PGRST002") return "schema_cache";
  if (code === "42501") return "rls_denied";
  if (code === "57014") return "timeout";
  return "unknown";
}
