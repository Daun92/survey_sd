import { redirect } from "next/navigation";
import { getUserProfile, canAccessHrd } from "@/lib/auth";

export default async function HrdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getUserProfile();
  if (!canAccessHrd(profile)) {
    redirect("/admin?error=unauthorized");
  }
  return <>{children}</>;
}
