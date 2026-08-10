// Shared Next.js App Router metadata for the NSW Design System fleet.
//
// One entry point: `defineSite()`. It returns the root layout's `metadata` and
// `viewport`, the `app/manifest.ts` default export, and `page()`/`article()`
// helpers for everything below the root.
//
// There is deliberately no way to build a page's metadata without the site
// context, because page-level metadata is where Next's merge model bites:
// `openGraph` and `twitter` are REPLACED wholesale by any segment that sets
// them (resolve-metadata.js), so a page writing `openGraph: { type: 'article' }`
// silently deletes the layout's entire OpenGraph block. `site.page()` cannot
// make that mistake; a hand-written page object can.
//
// This module imports nothing — not even from `next`. It is object literals all
// the way down; `next` is a peer solely so the TYPES in index.d.mts resolve.
//
// Everything here was checked against Next 16.3.0's `dist/`, not its prose docs,
// which are wrong in several places relevant to this package. Where a default is
// absent, that absence is usually load-bearing — see the notes on `icons`,
// `manifest` and `openGraph.images`.

/**
 * Brand constants shared by the metadata, the viewport and the manifest.
 *
 * Exported so anything else that needs the fleet's theme colour or OG image —
 * a bespoke manifest, a generated icon route — reads it from here rather than
 * hard-coding a second copy of the hex.
 */
export const BRAND = Object.freeze({
  themeColor: '#002664',
  backgroundColor: '#FFFFFF',
  // OpenGraph wants `language_TERRITORY`; the manifest wants a BCP 47
  // `language-TERRITORY` tag. Different separators, deliberately both here —
  // `en_AU` in a manifest is invalid and silently ignored.
  locale: 'en_AU',
  lang: 'en-AU',
  twitterSite: '@DigitalNSW',
  ogImage: Object.freeze({
    url: 'https://digitalnsw.github.io/images/og.png',
    width: 1200,
    height: 630,
    alt: 'NSW Government logo on a colour-block background',
  }),
})

/**
 * The manifest icons array, for a site that ships the PNGs to go with it.
 *
 * NOT a default. The fleet declares its icons through `app/icon.svg` and
 * `app/apple-icon.png`, and neither can appear in a manifest: Next serves every
 * static metadata image at a content-hashed URL (`/icon.svg?<16-hex-digest>`),
 * and there is no way to express `purpose: 'maskable'` through the file
 * conventions at all. A manifest icon has to be a real, stably-named file in
 * `public/`.
 *
 * So this is opt-in, for sites that want an install-prompt icon and have put
 * `icon-192.png`, `icon-512.png` and the two maskable variants in `public/`.
 * Without it the manifest simply has no icons, and Android's install prompt
 * falls back to a screenshot of the page.
 *
 * Two entries carry `purpose: 'maskable'` and two carry `any`. They are
 * deliberately separate files rather than one declaring `"any maskable"` — a
 * maskable icon has ~40% padding baked in, so reusing it for `any` renders a
 * small mark adrift in a large box everywhere else.
 *
 * @param {string} [iconBase] Path prefix, for sub-path deployments.
 */
export function manifestIcons(iconBase = '/') {
  const prefix = iconBase.endsWith('/') ? iconBase : `${iconBase}/`
  return [
    { src: `${prefix}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${prefix}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: `${prefix}icon-maskable-192.png`,
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: `${prefix}icon-maskable-512.png`,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
    // Declared last and sized 'any' so a browser that prefers vector can take
    // it, while the PNGs above remain the ones every installer understands.
    { src: `${prefix}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ]
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Drop keys whose value is `undefined`, recursively.
 *
 * This is not tidiness. `mergeMetadata` iterates `for (const key_ in metadata)`,
 * so a key that is merely PRESENT with an `undefined` value resets the inherited
 * value to null for most fields — `openGraph: undefined` in a page deletes the
 * layout's entire OpenGraph block. Stripping the key is the only way to say
 * "leave this alone".
 *
 * Only plain objects and arrays are walked. `metadataBase` is a URL instance and
 * must survive untouched; a naive deep walk would flatten it to `{}`.
 */
function compact(value) {
  if (Array.isArray(value)) return value.map(compact)
  if (value === null || typeof value !== 'object') return value
  if (Object.getPrototypeOf(value) !== Object.prototype) return value

  const result = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue
    result[key] = compact(item)
  }
  return result
}

// `fn` is passed rather than hard-coded so an error names the function the
// caller actually invoked, instead of sending them to the wrong file.
function requireString(value, name, fn) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${fn}: \`${name}\` is required and must be a non-empty string.`)
  }
  return value
}

function normaliseImage(image) {
  return typeof image === 'string' ? { url: image } : { ...image }
}

function toIsoString(value, name) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(
      `defineSite: \`${name}\` is not a valid date (got ${JSON.stringify(value)}).`,
    )
  }
  return date.toISOString()
}

/**
 * `robots`, for the site or for one page.
 *
 * `max-image-preview: large` is the highest-value directive available here: it
 * unlocks full-size image previews in results and is a precondition for Google
 * Discover eligibility — exactly the surface public-information and emergency
 * content wants.
 *
 * Deliberately absent: `notranslate`. It tells Google not to offer translation,
 * which is indefensible for a NSW audience. Do not add it.
 *
 * Always returns the FULL object rather than a partial, because a page that
 * emits `robots` replaces the layout's value outright — a page adding only
 * `unavailable_after` would otherwise silently drop `max-image-preview`.
 */
function buildRobots({ noIndex, unavailableAfter }) {
  if (noIndex) return { index: false, follow: false }
  return compact({
    index: true,
    follow: true,
    'max-image-preview': 'large',
    // Zero validation on Next's side — it is interpolated raw — so coerce here.
    unavailable_after: unavailableAfter
      ? toIsoString(unavailableAfter, 'unavailableAfter')
      : undefined,
  })
}

/**
 * The OpenGraph block, restated in full.
 *
 * Called for the root layout and for `article()`, never for a plain `page()`.
 * Note what is NOT here: `title` and `description`. `inheritFromMetadata` copies
 * the segment's own fully-resolved title (template already applied) and
 * description into the og block for free. Setting them at the root would pin the
 * homepage's strings onto every page in the site.
 *
 * `url` is `'./'`, not the site root: `resolveRelativeUrl` rewrites a `./`-
 * prefixed string against the current pathname, so every page reports its own
 * `og:url`. An absolute site URL here would collapse every share into one card.
 */
function buildOpenGraph({ siteName, locale, image, overrides }) {
  const openGraph = {
    siteName,
    locale,
    type: 'website',
    url: './',
  }

  // `image: false` must OMIT the key, not set it to undefined: the guard that
  // re-enables `app/opengraph-image.*` is a hasOwnProperty check, so a present
  // key with any value suppresses the file convention.
  if (image !== false) openGraph.images = [normaliseImage(image ?? BRAND.ogImage)]

  return { ...openGraph, ...overrides }
}

/**
 * The Twitter block.
 *
 * `card` MUST stay while any twitter key is set, and this is the least obvious
 * rule in the package. `resolveTwitter` computes
 * `card || (images?.length ? 'summary_large_image' : 'summary')` from
 * `twitter.images` AT THAT MOMENT — before the OpenGraph autofill runs — and
 * never recomputes it. So the instant we set `site`, `images` is still
 * undefined, the card locks to `'summary'`, and every NSW link renders as a
 * small square card.
 *
 * `title`, `description` and `images` are deliberately absent. Setting `images`
 * suppresses `app/twitter-image.*` (again a hasOwnProperty guard), and the
 * autofill copies the full OG image descriptor — which also gets us
 * `twitter:image:alt` for free.
 */
function buildTwitter({ creator }) {
  return compact({
    card: 'summary_large_image',
    site: BRAND.twitterSite,
    // `site` is the publisher, `creator` is the author. Different roles, so no
    // default — defaulting creator to the fleet handle misattributes authorship.
    creator,
  })
}

function buildMetadata(site) {
  const { title, description, siteName, titleTemplate, locale, url, shortName } = site

  let metadataBase
  try {
    metadataBase = new URL(url)
  } catch {
    throw new TypeError(`defineSite: \`url\` must be an absolute URL (got ${JSON.stringify(url)}).`)
  }

  // `%s` is a GLOBAL replace — `template.replace(/%s/g, title)` in
  // resolve-title.js. Two placeholders render the title twice
  // ("Contact | Contact | Site"); they do not drop the second. Zero
  // placeholders makes every child page render the same title.
  const placeholders = titleTemplate.split('%s').length - 1
  if (placeholders !== 1) {
    throw new TypeError(
      `defineSite: \`titleTemplate\` must contain exactly one "%s" (got ${placeholders} in ${JSON.stringify(titleTemplate)}).`,
    )
  }

  return compact({
    metadataBase,
    title: { default: title, template: titleTemplate },
    description,
    // './' resolves against the current pathname, so every page self-canonicalises.
    // A literal '/' would resolve to the bare origin and make every page in the
    // site declare the homepage as its canonical.
    alternates: { canonical: site.canonical, ...site.alternates },
    robots: buildRobots(site),
    openGraph: buildOpenGraph({
      siteName,
      locale,
      image: site.image,
      overrides: site.openGraph,
    }),
    twitter: buildTwitter({ creator: site.twitterCreator }),
    // Legacy-iOS insurance only. On iOS 16.4+ the manifest's `display` is what
    // produces a standalone app, and 16.3.0 emits the standardised
    // `mobile-web-app-capable` regardless. `statusBarStyle` is omitted because
    // the resolver supplies it for any object-shaped value.
    appleWebApp: site.appleWebApp === false ? undefined : { capable: true, title: shortName },
    verification: site.verification,
    formatDetection: site.formatDetection,
    authors: site.authors,
    other: site.other,
    pagination: site.pagination,
    // NO DEFAULT for either of these — the absence is the feature.
    //
    // `icons`: the fleet declares icons through app/favicon.ico, app/icon.svg
    // and app/apple-icon.png. Setting this does not merge with them. The guard
    // at resolve-metadata.js:812-825 is `if (!resolvedMetadata.icons)`, so any
    // value suppresses app/icon.* and app/apple-icon.* — while the favicon
    // unshift at :660-668 is UNCONDITIONAL, so favicon.ico survives. The result
    // is a half-broken icon set, which is harder to notice than a fully broken
    // one. `icons: {}` suppresses everything and emits no tags at all.
    //
    // `manifest`: ownership runs the OPPOSITE way. mergeStaticMetadata does a
    // bare `if (manifest) { target.manifest = manifest }`, so app/manifest.ts
    // overwrites whatever we set. A default here is dead code where the
    // convention exists and a link to a 404 where it does not.
    icons: site.icons,
  })
}

/**
 * Metadata for a page or a nested layout.
 *
 * Emits NO `openGraph` key unless the page overrides the image, because any
 * segment that sets `openGraph` replaces the layout's entire block. The og title
 * and description are inherited from this page's own title/description for free.
 */
function buildPageMetadata(site, options) {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('site.page: an options object is required.')
  }

  const title =
    typeof options.title === 'object' && options.title !== null
      ? { absolute: requireString(options.title.absolute, 'title.absolute', 'site.page') }
      : requireString(options.title, 'title', 'site.page')

  return compact({
    title,
    description: options.description,
    alternates: { canonical: options.canonical ?? './' },
    robots: buildRobots(options),
    other: options.other,
    // Strings only. A URL instance is treated as a BASE and has its path
    // replaced by the current pathname, which is never what anyone means.
    pagination: options.pagination,
    // Only when the page overrides the image, and then the WHOLE block, because
    // a partial would replace the layout's.
    openGraph:
      options.image === undefined
        ? undefined
        : buildOpenGraph({
            siteName: site.siteName,
            locale: site.locale,
            image: options.image,
            overrides: undefined,
          }),
  })
}

/** Metadata for an article. Restates the full og block, then adds `article:*`. */
function buildArticleMetadata(site, options) {
  const base = buildPageMetadata(site, options)

  return compact({
    ...base,
    openGraph: {
      ...buildOpenGraph({
        siteName: site.siteName,
        locale: site.locale,
        image: options.image,
        overrides: undefined,
      }),
      type: 'article',
      publishedTime: options.published ? toIsoString(options.published, 'published') : undefined,
      // "Has this guidance changed since I read it?" is often the single most
      // important fact on a government page.
      modifiedTime: options.modified ? toIsoString(options.modified, 'modified') : undefined,
      expirationTime: options.expires ? toIsoString(options.expires, 'expires') : undefined,
      section: options.section,
      tags: options.tags,
    },
  })
}

function buildViewport(overrides = {}) {
  if (overrides === null || typeof overrides !== 'object') {
    throw new TypeError('defineSite: `viewport` must be an object.')
  }

  // WCAG 2.2 SC 1.4.4 (AA), failure technique F69. Neither key is in the option
  // types; these guards exist for JS callers and `as any` casts. Next's own
  // generate-viewport.md prints `maximumScale: 1` in a copy-pasteable example,
  // which is exactly how this reaches a codebase.
  if (overrides.userScalable === false) {
    throw new TypeError(
      'defineSite: `viewport.userScalable: false` emits user-scalable=no, which fails WCAG 2.2 SC 1.4.4 (F69). Remove it.',
    )
  }
  if (typeof overrides.maximumScale === 'number' && overrides.maximumScale < 2) {
    throw new TypeError(
      `defineSite: \`viewport.maximumScale: ${overrides.maximumScale}\` caps enlargement below the 200% required by WCAG 2.2 SC 1.4.4. Remove it.`,
    )
  }

  // compact()-ed for the same reason as the metadata: mergeViewport's layout
  // branch is documented in-source as "always override the target with the
  // source" and is reached by for...in, so an own key holding `undefined`
  // overrides. Without this, `{ initialScale: undefined }` drops initial-scale=1.
  return compact({
    width: 'device-width',
    initialScale: 1,
    // A single string, never the media array: `manifest.theme_color` is a bare
    // string with no media form, so an array guarantees permanent disagreement
    // with the installed app's own chrome.
    themeColor: overrides.themeColor ?? BRAND.themeColor,
    // No default. This is a claim about the site's CSS, not its brand —
    // 'light dark' on a site with no dark stylesheet gives dark native form
    // controls on a light page.
    colorScheme: overrides.colorScheme,
    viewportFit: overrides.viewportFit,
    interactiveWidget: overrides.interactiveWidget,
  })
}

function buildManifest(site, options = {}) {
  const name = options.name ?? site.siteName
  const shortName = options.shortName ?? site.shortName

  requireString(name, 'manifest.name', 'defineSite')
  requireString(shortName, 'manifest.shortName', 'defineSite')

  const startUrl = options.startUrl ?? '/'
  const scope = options.scope ?? startUrl

  // Fresh object per invocation: the route may render more than once across a
  // build, and a shared object would let one caller's mutation leak.
  return function manifest() {
    return compact({
      // Pins the app's identity. Without it, identity derives from start_url —
      // so changing start_url later installs a SECOND copy of the app alongside
      // the first instead of updating it. Unrecoverable in the field.
      id: options.id ?? scope,
      name,
      short_name: shortName,
      description: options.description ?? site.description,
      lang: options.lang ?? BRAND.lang,
      dir: options.dir ?? 'ltr',
      // Not set by the spec's default, which is the *document* URL of whatever
      // page linked the manifest — so two users installing from different pages
      // would otherwise get different start URLs.
      start_url: startUrl,
      scope,
      // Removes the URL bar. For a government service that is a real trust
      // trade-off, and still the right default — but it is a decision.
      display: 'standalone',
      theme_color: options.themeColor ?? BRAND.themeColor,
      // Splash canvas, not chrome. Brand blue here would give a blue splash that
      // no NSW page then matches.
      background_color: options.backgroundColor ?? BRAND.backgroundColor,
      icons: options.icons?.map((icon) => ({ ...icon })),
      // Needs BOTH a 'wide' and a 'narrow' entry or Chrome falls back to the
      // minimal install chip — supplying only one is worse than supplying none.
      screenshots: options.screenshots?.map((shot) => ({ ...shot })),
      // `url` must be inside `scope` or the entry is dropped without warning.
      shortcuts: options.shortcuts?.map((shortcut) => ({ ...shortcut })),
      related_applications: options.relatedApplications?.map((app) => ({ ...app })),
      categories: options.categories ? [...options.categories] : undefined,
      // Deliberately not exposed: `orientation`. Locking an installed app to
      // portrait fails WCAG 2.2 SC 1.3.4 and excludes users with a device
      // mounted to a wheelchair or stand — and because it only manifests in the
      // INSTALLED app, it survives every browser-based audit.
    })
  }
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/**
 * Define a site once, then use it from the root layout, `app/manifest.ts` and
 * every page.
 *
 * @example
 * // lib/site.ts
 * export const site = defineSite({
 *   title: 'Public Sans (NSW) Download',
 *   description: 'Download Public Sans, the official NSW Government typeface.',
 *   url: 'https://public-sans.digital.nsw.gov.au/',
 * })
 *
 * // app/layout.tsx
 * export const { metadata, viewport } = site
 *
 * // app/manifest.ts
 * export default site.manifest
 *
 * // app/guidance/page.tsx
 * export const metadata = site.page({ title: 'Guidance' })
 */
export function defineSite(options) {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('defineSite: an options object is required.')
  }

  const title = requireString(options.title, 'title', 'defineSite')
  const description = requireString(options.description, 'description', 'defineSite')
  const url = requireString(options.url, 'url', 'defineSite')

  const siteName = options.siteName ?? title
  const site = {
    title,
    description,
    url,
    siteName,
    // Also the appleWebApp title, which is why it wants to be short — both are
    // rendered as a home screen label and truncate past ~12 characters.
    shortName: options.shortName ?? siteName,
    titleTemplate: options.titleTemplate ?? `%s | ${siteName}`,
    locale: options.locale ?? BRAND.locale,
    canonical: options.canonical ?? './',
    image: options.image,
    noIndex: options.noIndex,
    unavailableAfter: options.unavailableAfter,
    twitterCreator: options.twitterCreator,
    openGraph: options.openGraph,
    verification: options.verification,
    alternates: options.alternates,
    formatDetection: options.formatDetection,
    authors: options.authors,
    other: options.other,
    pagination: options.pagination,
    appleWebApp: options.appleWebApp,
    icons: options.icons,
  }

  return {
    metadata: buildMetadata(site),
    viewport: buildViewport(options.viewport),
    manifest: buildManifest(site, options.manifest),
    page: (pageOptions) => buildPageMetadata(site, pageOptions),
    article: (articleOptions) => buildArticleMetadata(site, articleOptions),
  }
}
