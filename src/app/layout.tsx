import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import { ErrorBoundary } from './components/ErrorBoundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'Noah Shaw | Product Leader',
  description: 'Product leader building and scaling AI/ML products in complex and safety-critical domains',
  robots: {
    index: false,
    follow: false,
  },
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
    <html lang="en">
      <body className="font-sans">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
