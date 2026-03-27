"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";
import { updateProfile } from "./actions";

interface ProfileProps {
  section: "profile";
  currentDisplayName: string;
}

interface PasswordProps {
  section: "password";
  currentDisplayName?: never;
}

type Props = ProfileProps | PasswordProps;

export function AccountForm(props: Props) {
  if (props.section === "profile") {
    return <ProfileForm currentDisplayName={props.currentDisplayName} />;
  }
  return <PasswordForm />;
}

function ProfileForm({ currentDisplayName }: { currentDisplayName: string }) {
  const [name, setName] = useState(currentDisplayName);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await updateProfile(name);
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="block text-xs font-medium text-stone-700 mb-1.5">
        이름
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
          placeholder="홍길동"
          className="flex-1 rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading || name.trim() === currentDisplayName}
          className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {loading ? "저장 중..." : "저장"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {success && (
        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
          <Check size={12} /> 저장되었습니다
        </p>
      )}
    </form>
  );
}

function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess(true);
      setPassword("");
      setConfirm("");
      setTimeout(() => setSuccess(false), 5000);
    } catch {
      setError("비밀번호 설정에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1.5">
          새 비밀번호
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="6자 이상"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-stone-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-700 mb-1.5">
          비밀번호 확인
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          placeholder="한 번 더 입력"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-stone-400"
        />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      {success && (
        <p className="flex items-center gap-1 text-xs text-emerald-600">
          <Check size={12} /> 비밀번호가 설정되었습니다. 다음 로그인부터 사용할 수 있습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password || !confirm}
        className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "설정 중..." : "비밀번호 설정"}
      </button>
    </form>
  );
}
