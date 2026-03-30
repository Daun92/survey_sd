import { NextRequest, NextResponse } from "next/server";
import { requireAuthAPI, requireRoleAPI, type AppRole } from "@/lib/auth";

/**
 * API Route 공통 래퍼
 * - 인증 검증
 * - try-catch 에러 핸들링
 * - 일관된 에러 응답 형식
 */

type AuthMode =
  | { type: "public" }
  | { type: "auth" }
  | { type: "role"; minRole: AppRole };

type HandlerContext = {
  user?: { id: string; email?: string };
  params?: Record<string, string>;
};

/**
 * API 핸들러를 인증 + 에러 핸들링으로 감싸는 래퍼
 *
 * @example
 * // 인증 필요한 라우트
 * export const GET = withAuth({ type: "auth" }, async (req, ctx) => {
 *   const data = await prisma.customer.findMany();
 *   return NextResponse.json(data);
 * });
 *
 * // 관리자 전용 라우트
 * export const DELETE = withAuth({ type: "role", minRole: "admin" }, async (req, ctx) => {
 *   // ...
 * });
 *
 * // 공개 라우트 (에러 핸들링만)
 * export const GET = withAuth({ type: "public" }, async (req, ctx) => {
 *   // ...
 * });
 */
export function withAuth(
  auth: AuthMode,
  handler: (req: NextRequest, ctx: HandlerContext) => Promise<NextResponse>
) {
  return async (req: NextRequest, routeCtx?: { params?: Promise<Record<string, string>> }) => {
    try {
      let user: { id: string; email?: string } | undefined;

      // 인증 검증
      if (auth.type === "auth") {
        const result = await requireAuthAPI();
        if (result.error) return result.error;
        user = result.user;
      } else if (auth.type === "role") {
        const result = await requireRoleAPI(auth.minRole);
        if (result.error) return result.error;
        user = { id: result.profile.id, email: result.profile.email };
      }

      // Next.js 15+ params are async
      const params = routeCtx?.params ? await routeCtx.params : undefined;

      return await handler(req, { user, params });
    } catch (error) {
      console.error(`[API Error] ${req.method} ${req.nextUrl.pathname}:`, error);

      // Zod 검증 에러
      if (error instanceof Error && error.name === "ZodError") {
        return NextResponse.json(
          { error: "입력값이 올바르지 않습니다", details: (error as any).errors },
          { status: 400 }
        );
      }

      // Prisma 에러
      if (error instanceof Error && error.message?.includes("Record to")) {
        return NextResponse.json(
          { error: "요청한 리소스를 찾을 수 없습니다" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "서버 오류가 발생했습니다" },
        { status: 500 }
      );
    }
  };
}

/**
 * JSON body를 안전하게 파싱
 */
export async function parseJsonBody<T>(req: NextRequest): Promise<T> {
  try {
    return await req.json() as T;
  } catch {
    throw new ApiError("유효하지 않은 JSON 형식입니다", 400);
  }
}

/**
 * 커스텀 API 에러 (상태 코드 포함)
 */
export class ApiError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "ApiError";
  }
}
