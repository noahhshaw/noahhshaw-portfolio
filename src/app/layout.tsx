import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import { ErrorBoundary } from './components/ErrorBoundary'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.noahhshaw.com'),
  title: 'Noah Shaw',
  description: 'Product leader building and scaling AI/ML products in complex and safety-critical domains',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Noah Shaw',
    description: 'Product leader building and scaling AI/ML products in complex and safety-critical domains',
    url: 'https://www.noahhshaw.com',
    siteName: 'Noah Shaw',
    type: 'website',
    images: [
      {
        url: '/profile.jpg',
        width: 1704,
        height: 1992,
        alt: 'Noah Shaw headshot',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Noah Shaw',
    description: 'Product leader building and scaling AI/ML products in complex and safety-critical domains',
    images: ['/profile.jpg'],
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
