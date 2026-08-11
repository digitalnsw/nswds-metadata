import type { ReactNode } from 'react'

import { site } from '../../lib/site'

// An INTERMEDIATE layout — the only place the title-template bug is observable.
// A bare-string title here stashes `template: null`, so every route below it
// loses the suffix. site.page() returns { default, template } to prevent that.
export const metadata = site.page({
  title: 'Guidance',
  description: 'A nested route, for canonical resolution.',
})

export default function GuidanceLayout({ children }: { children: ReactNode }) {
  return children
}
