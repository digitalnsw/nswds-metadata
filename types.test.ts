// Compile-only test. `tsc --noEmit` is the assertion — there is nothing to run.
//
// This file is the only thing keeping the hand-written index.d.mts honest
// against index.mjs. The `@ts-expect-error` lines are assertions in both
// directions: each one FAILS the build if the error it expects stops occurring,
// so a declaration that accidentally widens to `any` is caught here.

import type { Metadata, MetadataRoute, Viewport } from 'next'

import { BRAND, defineSite, manifestIcons } from './index.mjs'

const site = defineSite({
  title: 'Public Sans (NSW) Download',
  description: 'Download Public Sans, the official NSW Government typeface.',
  url: 'https://public-sans.digital.nsw.gov.au/',
})

// The shape a root layout exports. Next's type plugin does NOT typecheck
// `export const metadata`, so these assignments are the only thing proving the
// return types are actually assignable.
export const metadata: Metadata = site.metadata
export const viewport: Viewport = site.viewport
export const manifest: () => MetadataRoute.Manifest = site.manifest

export const page: Metadata = site.page({ title: 'Guidance' })
export const notFound: Metadata = site.page({ title: { absolute: 'Page not found' } })
export const article: Metadata = site.article({
  title: 'New guidance',
  description: 'What changed.',
  published: '2026-08-01',
  modified: new Date(),
  section: 'Health',
  tags: ['guidance'],
})

// Evergreen documentation: og:type article with no publication date.
export const undatedArticle: Metadata = site.article({ title: 'Getting started' })

export const fullyConfigured = defineSite({
  title: 'Public Sans (NSW) Download',
  description: '…',
  url: 'https://public-sans.digital.nsw.gov.au/',
  siteName: 'Public Sans',
  shortName: 'Public Sans',
  locale: 'en_AU',
  canonical: './',
  image: { url: '/og.png', width: 1200, height: 630, alt: 'Public Sans' },
  noIndex: false,
  twitterCreator: '@DigitalNSW',
  openGraph: { type: 'article' },
  verification: { google: 'token' },
  alternates: { types: { 'application/rss+xml': '/feed.xml' } },
  formatDetection: { date: false },
  other: { 'msvalidate.01': 'bing-token' },
  viewport: { colorScheme: 'light dark', viewportFit: 'cover' },
  manifest: { icons: manifestIcons(), categories: ['government'] },
})

// The documented escape hatch for a field the options do not cover: spread the
// result. `site.metadata` is a plain object.
export const withExtra: Metadata = {
  ...site.metadata,
  alternates: { canonical: './', languages: { 'en-AU': '/' } },
}

export const icons: NonNullable<MetadataRoute.Manifest['icons']> = manifestIcons('/thing/')
export const themeColor: string = BRAND.themeColor
export const ogImageWidth: number = BRAND.ogImage.width

const base = { title: 'x', description: 'y', url: 'https://example.nsw.gov.au/' }

// @ts-expect-error `title` is required
defineSite({ description: base.description, url: base.url })

// @ts-expect-error `url` is required
defineSite({ title: base.title, description: base.description })

// @ts-expect-error `userScalable` is not exposed — it fails WCAG 2.2 SC 1.4.4
defineSite({ ...base, viewport: { userScalable: false } })

// @ts-expect-error `maximumScale` is not exposed — capping enlargement fails SC 1.4.4
defineSite({ ...base, viewport: { maximumScale: 1 } })

// @ts-expect-error `orientation` is not exposed — locking it fails WCAG 2.2 SC 1.3.4
defineSite({ ...base, manifest: { orientation: 'portrait' } })

// @ts-expect-error `display` is pinned to 'standalone'
defineSite({ ...base, manifest: { display: 'browser' } })

// @ts-expect-error `icons` has no `false` — omitting it is what lets app/icon.* emit
defineSite({ ...base, icons: false })

// @ts-expect-error `canonical` is owned by the package — use the top-level option
defineSite({ ...base, alternates: { canonical: '/' } })

// @ts-expect-error `keywords` was removed — a dead tag Bing reads as a spam signal
defineSite({ ...base, keywords: ['NSW Government'] })

// @ts-expect-error the flat API is gone; defineSite is the only entry point
export { createMetadata } from './index.mjs'

// @ts-expect-error BRAND is readonly — a consumer must not retune the palette
BRAND.themeColor = '#ff0000'
