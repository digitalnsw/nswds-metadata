import type { ReactNode } from 'react'

import { site } from '../lib/site'

export const { metadata, viewport } = site

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en-AU'>
      <body>{children}</body>
    </html>
  )
}
