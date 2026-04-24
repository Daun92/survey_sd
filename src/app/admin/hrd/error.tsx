"use client";

import { SectionError } from "@/components/admin/section-error";

export default function HrdError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SectionError error={error} reset={reset} section="HRD 실태조사" />;
}
