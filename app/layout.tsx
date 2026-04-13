import type { Metadata } from "next"
import { AuthProvider } from "@/lib/auth-context"
import "./globals.css"

export const metadata: Metadata = {
  title: "TGM Consigliere",
  description: "Clan-Management für The Grand Mafia — powered by Camorra Elite [1Ca]",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body className="antialiased" style={{ background: "#0C0A08", color: "#E8C87A" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
