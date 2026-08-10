import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Sahabat Telur | Buku Keuangan Usaha",
  description: "Aplikasi pencatatan keuangan usaha perdagangan telur, rekap penjualan, operasional, dan tagihan piutang bakul.",
  openGraph: {
    title: "Sahabat Telur | Buku Keuangan Usaha",
    description: "Aplikasi pencatatan keuangan usaha perdagangan telur, rekap penjualan, operasional, dan tagihan piutang bakul.",
    siteName: "Sahabat Telur",
  },
  icons: {
    icon: "/f66c6a5a-c43e-4d5b-9105-6888d8892eb5.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        className="min-h-screen text-foreground bg-background font-sans antialiased"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
