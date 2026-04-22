"use client";

import { SectionError } from "@/components/admin/section-error";

export default function DistributeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SectionError error={error} reset={reset} section="배부" />;
}
