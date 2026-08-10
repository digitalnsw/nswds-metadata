// Hand-written declarations.
//
// This package has no build step (see README) — these are the published type
// surface, and nothing generates them. `types.test.ts` + `tsc --noEmit` in CI
// is what keeps them honest against index.mjs; without that they would drift
// silently, because a wrong `.d.ts` still compiles.
//
// Types come from `next`, which is a required peer for exactly this reason.

import type { Metadata, MetadataRoute, Viewport } from 'next'

export interface BrandOgImage {
  readonly url: string
  readonly width: number
  readonly height: number
  readonly alt: string
}

export interface Brand {
  readonly themeColor: string
  readonly backgroundColor: string
  /** OpenGraph locale, underscore-separated (`en_AU`). */
  readonly locale: string
  /** BCP 47 language tag, hyphen-separated (`en-AU`). */
  readonly lang: string
  readonly twitterSite: string
  readonly ogImage: BrandOgImage
}

export declare const BRAND: Brand

export interface OgImage {
  url: string
  width?: number
  height?: number
  /** Required in practice — WCAG applies to the social card, and this feeds `twitter:image:alt`. */
  alt?: string
}

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

export interface ViewportOptions {
  /**
   * Single string only. `manifest.theme_color` has no media form, so the
   * light/dark array guarantees permanent disagreement with the installed app.
   */
  themeColor?: string
  /**
   * No default — this describes the SITE'S CSS, not its brand. `'light dark'`
   * if the site wires up the design system's `.dark` class; `'only light'` if
   * not. Getting it wrong gives dark native form controls on a light page.
   */
  colorScheme?: 'light' | 'dark' | 'light dark' | 'only light'
  /** Requires `env(safe-area-inset-*)` padding in CSS, or content sits under the notch. */
  viewportFit?: 'auto' | 'cover' | 'contain'
  /** Chromium only; Safari ignores it. */
  interactiveWidget?: 'resizes-visual' | 'resizes-content' | 'overlays-content'
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export interface ManifestOptions {
  /** Defaults to the site's `siteName`. */
  name?: string
  /** Defaults to the site's `shortName`. Truncates past ~12 characters. */
  shortName?: string
  /** Defaults to the site's `description`. */
  description?: string
  /** Defaults to `scope`. Changing `start_url` without pinning this installs a second copy. */
  id?: string
  startUrl?: string
  scope?: string
  lang?: string
  dir?: 'ltr' | 'rtl' | 'auto'
  themeColor?: string
  backgroundColor?: string
  /**
   * Real, stably-named files in `public/`. Omitted by default — `app/icon.svg`
   * is content-hashed and cannot be referenced from a manifest. See `manifestIcons()`.
   */
  icons?: MetadataRoute.Manifest['icons']
  /** Needs BOTH a `'wide'` and a `'narrow'` entry, or Chrome shows the minimal chip. */
  screenshots?: MetadataRoute.Manifest['screenshots']
  /** Each `url` must be inside `scope` or the entry is dropped without warning. */
  shortcuts?: MetadataRoute.Manifest['shortcuts']
  relatedApplications?: MetadataRoute.Manifest['related_applications']
  categories?: string[]
  // Deliberately absent: `orientation` (WCAG 2.2 SC 1.3.4), `display` (pinned to
  // 'standalone'), display_override, launch_handler, share_target,
  // file_handlers, protocol_handlers, prefer_related_applications.
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export interface PageOptions {
  /** A plain string uses the site's title template; `{ absolute }` opts out of it. */
  title: string | { absolute: string }
  description?: string
  /** Defaults to `'./'` — the current route. */
  canonical?: string
  noIndex?: boolean
  /**
   * Overrides the site's OG image for this page. Setting it makes the page
   * restate the whole OpenGraph block, because a partial one would replace the
   * layout's. `false` omits the images key, re-enabling `app/opengraph-image.*`.
   */
  image?: string | OgImage | false
  other?: Metadata['other']
  /** `rel="prev"`/`rel="next"`. STRINGS ONLY — a `URL` is treated as a base. */
  pagination?: Metadata['pagination']
  /** Consultation close, grant round end, resolved incident. Coerced to ISO 8601. */
  unavailableAfter?: string | Date
}

export interface ArticleOptions extends PageOptions {
  published: string | Date
  /** "Has this guidance changed since I read it?" — often the most important fact on the page. */
  modified?: string | Date
  expires?: string | Date
  /** One top-level category: 'Health', 'Transport', 'Education'. */
  section?: string
  tags?: string[]
}

// ---------------------------------------------------------------------------
// defineSite
// ---------------------------------------------------------------------------

export interface SiteOptions {
  /** Required. The site's default `<title>`. */
  title: string
  /** Required. Also the fallback for `og:description` and `twitter:description`. */
  description: string
  /** Required, absolute. Becomes `metadataBase`. Throws eagerly if not parseable. */
  url: string

  /** Defaults to `title`. Used for `og:site_name`, the title template and the manifest name. */
  siteName?: string
  /** Defaults to `siteName`. The home-screen label — keep it under ~12 characters. */
  shortName?: string
  /** Defaults to `` `%s | ${siteName}` ``. Must contain exactly one `%s`. */
  titleTemplate?: string
  /** OpenGraph locale, underscore form. Defaults to `'en_AU'`. */
  locale?: string
  /** Defaults to `'./'`, so every page self-canonicalises. Absolute only to point off-site. */
  canonical?: string
  /**
   * Social image. Defaults to `BRAND.ogImage`. `false` omits the images key
   * entirely, which re-enables `app/opengraph-image.*`.
   */
  image?: string | OgImage | false
  /** Emits `noindex, nofollow`. Otherwise `index, follow, max-image-preview:large`. */
  noIndex?: boolean
  /** Site-wide expiry. Rare — usually a page concern. Coerced to ISO 8601. */
  unavailableAfter?: string | Date

  /** The author's handle. `twitter:site` is the publisher and is always `@DigitalNSW`. */
  twitterCreator?: `@${string}`
  /** Shallow-merged OVER the computed OpenGraph defaults. */
  openGraph?: Metadata['openGraph']
  /** Search Console tokens. For Bing use `other: { 'msvalidate.01': '…' }` — Next has no `bing` key. */
  verification?: Metadata['verification']
  /** hreflang and feed alternates. `canonical` is owned by this package — use the option above. */
  alternates?: Omit<NonNullable<Metadata['alternates']>, 'canonical'>
  /**
   * Only keys set to `false` emit anything. Never default `telephone: false` —
   * it kills tap-to-call on the very pages that exist to generate calls.
   */
  formatDetection?: Metadata['formatDetection']
  /** `url` must be ABSOLUTE — Next does not resolve it against `metadataBase`. */
  authors?: Metadata['authors']
  /** Arbitrary `<meta name=…>`. The only field that MERGES across segments. */
  other?: Metadata['other']
  pagination?: Metadata['pagination']
  /** Legacy-iOS insurance. `false` omits it. The title is always the site's `shortName`. */
  appleWebApp?: false
  /**
   * ESCAPE HATCH ONLY. Any non-null value suppresses `app/icon.*` and
   * `app/apple-icon.*` — `app/favicon.ico` survives, so the failure is partial
   * and easy to miss. `{}` suppresses everything and emits no tags at all.
   */
  icons?: Metadata['icons']

  viewport?: ViewportOptions
  manifest?: ManifestOptions
}

export interface Site {
  /** For the root layout: `export const { metadata, viewport } = site`. */
  readonly metadata: Metadata
  readonly viewport: Viewport
  /** For `app/manifest.ts`: `export default site.manifest`. */
  readonly manifest: () => MetadataRoute.Manifest
  /**
   * For a page or nested layout. Emits NO `openGraph` key unless the page
   * overrides the image — a segment that sets `openGraph` REPLACES the layout's
   * entire block, and `og:title`/`og:description` are inherited from the page's
   * own title and description for free.
   */
  page(options: PageOptions): Metadata
  /** Restates the full site OpenGraph block, then adds the `article:*` fields. */
  article(options: ArticleOptions): Metadata
}

/**
 * Define a site once; use it from the root layout, `app/manifest.ts` and pages.
 *
 * @throws {TypeError} if `url` is not absolute, if `titleTemplate` does not
 * contain exactly one `%s`, if a required option is missing, or if the viewport
 * would fail WCAG 2.2 SC 1.4.4 (`userScalable: false`, `maximumScale < 2`).
 */
export declare function defineSite(options: SiteOptions): Site

/**
 * Manifest icons for a site that ships `icon-{192,512}.png`, the two maskable
 * variants and `icon.svg` in `public/`. Pass to `manifest.icons` — it is not a
 * default, because `app/icon.svg` is content-hashed and cannot be referenced
 * from a manifest, and the file conventions cannot express `purpose: 'maskable'`.
 */
export declare function manifestIcons(
  iconBase?: string,
): NonNullable<MetadataRoute.Manifest['icons']>
