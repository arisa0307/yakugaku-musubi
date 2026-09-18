import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "薬学むすび｜模擬面接 相互評価",
  description: "模擬面接会の相互評価と、自分あてフィードバックの閲覧",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <div className="mx-auto w-full max-w-xl px-4 pb-24 pt-5">{children}</div>
      </body>
    </html>
  );
}
