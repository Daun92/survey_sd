import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(params.redirect || "/admin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          <div className="text-center mb-8">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-teal-600 text-white text-sm font-bold mb-3">
              E
            </div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              EXC-Survey
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              교육 만족도 설문 플랫폼
            </p>
          </div>

          {params.error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              인증에 실패했습니다. 다시 시도해 주세요.
            </div>
          )}

          <LoginForm redirectTo={params.redirect} />
        </div>
      </div>
    </div>
  );
}
