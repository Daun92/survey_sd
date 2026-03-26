"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "magic_link">("password");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    window.location.href = redirectTo || "/admin";
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const redirectUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo || "/admin")}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl },
    });

    if (error) {
      setError("이메일 발송에 실패했습니다. 다시 시도해 주세요.");
      setLoading(false);
      return;
    }

    setMagicLinkSent(true);
    setLoading(false);
  }

  if (magicLinkSent) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-teal-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-stone-900">메일을 확인해 주세요</h2>
        <p className="text-sm text-stone-500 mt-2">
          <span className="font-medium text-stone-700">{email}</span>
          <br />로 로그인 링크를 보냈습니다.
        </p>
        <button
          onClick={() => setMagicLinkSent(false)}
          className="mt-6 text-sm text-teal-600 hover:text-teal-700"
        >
          다른 방법으로 로그인
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}>
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
            이메일
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="name@company.com"
            className="w-full px-3 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-stone-400"
          />
        </div>

        {mode === "password" && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-stone-400"
            />
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "처리 중..." : mode === "password" ? "로그인" : "로그인 링크 받기"}
        </button>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => { setMode(mode === "password" ? "magic_link" : "password"); setError(null); }}
          className="text-sm text-stone-500 hover:text-teal-600 transition-colors"
        >
          {mode === "password" ? "이메일 링크로 로그인" : "비밀번호로 로그인"}
        </button>
      </div>
    </form>
  );
}
