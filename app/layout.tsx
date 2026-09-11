import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PITCH ARCHIVE",
  description: "自作のサッカーカードを追加して集める、デジタルカードアーカイブ。",
  applicationName: "PITCH ARCHIVE",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PITCH ARCHIVE",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url:"/favicon-32.png",sizes:"32x32",type:"image/png" },
      { url:"/icon-192.png",sizes:"192x192",type:"image/png" },
    ],
    shortcut: "/favicon-32.png",
    apple: [{ url:"/apple-touch-icon.png",sizes:"180x180",type:"image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#090a09",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }:Readonly<{ children:React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
