import { site } from '../../lib/site'

// A route one level down from the root. Its only job is to prove that
// `canonical: './'` and `og:url: './'` resolve against the CURRENT pathname —
// which cannot be observed from a single-route app, because at `/` the
// homepage's canonical and the site root are the same string.
export const metadata = site.page({
  title: 'Guidance',
  description: 'A nested route, for canonical resolution.',
})

export default function Page() {
  return <main>Guidance</main>
}
