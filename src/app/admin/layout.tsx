import { Sidebar } from "@/components/Sidebar";
import { getUserProfile } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userProfile = await getUserProfile();

  return (
    <div className="flex min-h-screen">
      <Sidebar userProfile={userProfile} />
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
