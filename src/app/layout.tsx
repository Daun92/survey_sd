import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EXC-Survey | 교육 만족도 설문 플랫폼",
  description: "엑스퍼트컨설팅 전용 설문 관리 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-stone-50 antialiased">{children}</body>
    </html>
  );
}
