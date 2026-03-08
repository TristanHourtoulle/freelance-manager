import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "FreelanceDash",
  description: "Freelance management dashboard — clients, billing, analytics",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className={`${geistMono.variable} antialiased`}>{children}</body>
    </html>
  )
}
