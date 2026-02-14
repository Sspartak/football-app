// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football App",
  description: "Система управления матчами",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className="antialiased overflow-x-hidden" 
        suppressHydrationWarning={true} // ДОБАВЬ ЭТО СЮДА
      >
        {children}
      </body>
    </html>
  );
}
