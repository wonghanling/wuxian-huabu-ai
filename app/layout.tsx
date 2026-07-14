import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Filmavo - Infinite AI Canvas",
  description: "AI 创意工作流画布。随心拖拽，无限扩展，自由连接节点，一键复用工作流模板，释放无限创意。",
  keywords: ["Filmavo", "AI 画布", "无限画布", "工作流", "AI 创作", "视频生成", "图像生成"],
  authors: [{ name: "Filmavo" }],
  openGraph: {
    title: "Filmavo - Infinite AI Canvas",
    description: "AI 创意工作流画布，随心拖拽无限扩展",
    siteName: "Filmavo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Filmavo",
    description: "AI 创意工作流画布",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
