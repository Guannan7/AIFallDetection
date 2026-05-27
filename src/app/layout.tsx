import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: '跌倒检测系统 | AI Fall Detection',
  description: '基于AI人体姿态识别的智能跌倒检测系统，支持图片、视频及摄像头实时识别',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN" className="dark">
      <body className={`antialiased bg-slate-950 text-slate-100`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
