import { getUserProfile } from "@/lib/auth";
import { User, Lock, Mail, Shield, Building2, Sparkles } from "lucide-react";
import { AccountForm } from "./account-form";

const roleLabels: Record<string, string> = {
  admin: "관리자",
  creator: "편집자",
  viewer: "조회자",
};

const departmentLabels: Record<string, string> = {
  im: "수행/IM",
  am: "AM",
  sales: "영업기획",
  marketing: "마케팅실",
  consulting: "컨설팅",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const profile = await getUserProfile();
  const params = await searchParams;
  const isSetup = params.setup === "true";

  return (
    <div className="max-w-2xl">
      {/* 첫 로그인 온보딩 배너 */}
      {isSetup && (
        <div className="mb-6 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 shrink-0">
              <Sparkles size={20} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                환영합니다!
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                비밀번호를 설정하면 다음부터 이메일 링크 없이 바로 로그인할 수
                있습니다. 이름도 함께 설정해 주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">계정 설정</h1>
        <p className="text-sm text-stone-500 mt-1">
          프로필 정보와 비밀번호를 관리하세요
        </p>
      </div>

      <div className="space-y-6">
        {/* 프로필 정보 카드 */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <User size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-stone-900">
                  프로필 정보
                </h2>
                <p className="text-xs text-stone-500">
                  대시보드에 표시되는 이름을 설정하세요
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4">
            {/* 이메일 (읽기전용) */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-1.5">
                <Mail size={12} />
                이메일
              </label>
              <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-sm text-stone-600">
                {profile.email}
              </div>
            </div>

            {/* 역할 (읽기전용) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-1.5">
                  <Shield size={12} />
                  역할
                </label>
                <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-sm text-stone-600">
                  {roleLabels[profile.role] || profile.role}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-1.5">
                  <Building2 size={12} />
                  부서
                </label>
                <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-sm text-stone-600">
                  {profile.department
                    ? departmentLabels[profile.department] || profile.department
                    : "미지정"}
                </div>
              </div>
            </div>

            {/* 이름 (편집 가능) — Client Component */}
            <AccountForm
              section="profile"
              currentDisplayName={profile.displayName}
            />
          </div>
        </div>

        {/* 비밀번호 설정 카드 */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <Lock size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-stone-900">
                  비밀번호 {isSetup ? "설정" : "변경"}
                </h2>
                <p className="text-xs text-stone-500">
                  {isSetup
                    ? "비밀번호를 설정하면 이메일 링크 없이 로그인할 수 있습니다"
                    : "로그인에 사용하는 비밀번호를 변경합니다"}
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            <AccountForm section="password" />
          </div>
        </div>

        {/* 설정 완료 후 대시보드 이동 */}
        {isSetup && (
          <div className="text-center pt-2">
            <a
              href="/admin"
              className="text-sm text-stone-500 hover:text-teal-600 transition-colors"
            >
              건너뛰고 대시보드로 이동 &rarr;
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
