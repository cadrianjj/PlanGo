import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Auto-loads the sleek Inter font
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PlanGo 旅享家",
  description: "Bilingual AI lifestyle concierge for planning, voting, execution, and live replanning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body className={inter.className}>{children}</body>
    </html>
  );
}