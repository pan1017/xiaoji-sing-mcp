
export const metadata = {
  title: "小机唱歌服务",
  description: "小机 Remote MCP Singing Server",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
