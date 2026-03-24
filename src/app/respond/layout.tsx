import { Manrope, Inter } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-expert-heading",
  weight: ["600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-expert-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata = {
  title: "Expert Survey",
};

export default function RespondLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`expert-theme ${manrope.variable} ${inter.variable}`}>
      {children}
    </div>
  );
}
