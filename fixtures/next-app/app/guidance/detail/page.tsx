import { site } from '../../../lib/site'

// Two levels deep. This is where the old bare-string title lost the template:
// /guidance set `title: 'Guidance'` as a plain string, which stashed
// `template: null`, so this route rendered "Detail" instead of "Detail | Fixture".
export const metadata = site.page({
  title: 'Detail',
  description: 'A depth-2 route, for title template survival.',
})

export default function Page() {
  return <main>Detail</main>
}
