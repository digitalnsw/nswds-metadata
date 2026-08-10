import { defineSite } from '@nswds/metadata'

// The idiom every consuming repo follows: one module owning site identity,
// imported by the root layout, app/manifest.ts and every page.
export const site = defineSite({
  title: 'Fixture',
  description: 'Build fixture for @nswds/metadata.',
  url: 'https://example.nsw.gov.au/',
})
