import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clanbank",
  description: "Clan-Ressourcenverwaltung für The Grand Mafia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="bg-gray-950 text-gray-100 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
