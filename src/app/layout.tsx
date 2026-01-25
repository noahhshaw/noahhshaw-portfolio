import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Noah Shaw | Product Leader',
  description: 'Product leader building and scaling AI/ML products in complex and safety-critical domains',
  openGraph: {
    title: 'Noah Shaw | Product Leader',
    description: 'Product leader building and scaling AI/ML products in complex and safety-critical domains',
    url: 'https://noahhshaw.com',
    siteName: 'Noah Shaw Portfolio',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
