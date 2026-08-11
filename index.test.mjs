import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BRAND, defineSite } from './index.mjs'

const options = {
  title: 'Public Sans (NSW) Download',
  description: 'Download Public Sans, the official NSW Government typeface.',
  url: 'https://public-sans.digital.nsw.gov.au/',
}

const site = defineSite(options)

// ---------------------------------------------------------------------------
// The three live defects this package was built with. Each of these is a
// regression test for a bug that shipped, not a hypothetical.
// ---------------------------------------------------------------------------

test('canonical is "./" so every page self-canonicalises', () => {
  // A literal '/' resolves to the bare origin, and because `alternates` is set
  // in the root layout and inherits everywhere, EVERY page of the site would
  // declare the homepage as its canonical. resolveRelativeUrl only rewrites
  // strings starting './'.
  assert.equal(site.metadata.alternates.canonical, './')
})

test('og:url is "./" so every page reports its own share identity', () => {
  // Scrapers use og:url as the canonical identity of a share. An absolute site
  // URL here collapses every page's shares into one card.
  assert.equal(site.metadata.openGraph.url, './')
})

test('openGraph carries no title or description', () => {
  // inheritFromMetadata copies each segment's own resolved title/description
  // into the og block for free. Setting them at the root pins the homepage's
  // strings onto every page in the site, permanently.
  assert.ok(!('title' in site.metadata.openGraph))
  assert.ok(!('description' in site.metadata.openGraph))
})

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

test('metadataBase is a URL instance', () => {
  assert.ok(site.metadata.metadataBase instanceof URL)
  assert.equal(site.metadata.metadataBase.href, options.url)
})

test('title is a template object with exactly one placeholder', () => {
  assert.equal(site.metadata.title.default, options.title)
  assert.equal(site.metadata.title.template.split('%s').length - 1, 1)
})

test('a titleTemplate without exactly one %s throws', () => {
  // %s is a GLOBAL replace — two placeholders render the title twice
  // ("Contact | Contact | Site"), they do not drop the second.
  assert.throws(() => defineSite({ ...options, titleTemplate: 'none' }), TypeError)
  assert.throws(() => defineSite({ ...options, titleTemplate: '%s | %s' }), TypeError)
})

test('openGraph keeps siteName, locale, type and the brand image', () => {
  const { openGraph } = site.metadata
  assert.equal(openGraph.siteName, options.title)
  assert.equal(openGraph.locale, 'en_AU')
  assert.equal(openGraph.type, 'website')

  const [image] = openGraph.images
  assert.equal(image.width, 1200)
  assert.equal(image.height, 630)
  assert.ok(image.alt.length > 0, 'the OG image needs alt text')
})

test('image: false omits the images key, re-enabling app/opengraph-image', () => {
  // Must OMIT the key, not set it to undefined — the guard that re-enables the
  // file convention is a hasOwnProperty check.
  const { openGraph } = defineSite({ ...options, image: false }).metadata
  assert.ok(!('images' in openGraph))
})

test('twitter keeps card but sets no title, description or images', () => {
  const { twitter } = site.metadata
  // card is load-bearing: resolveTwitter computes it from twitter.images at
  // that moment, BEFORE the OG autofill runs, and never recomputes. Drop it
  // while any twitter key is set and every link renders as a small square card.
  assert.equal(twitter.card, 'summary_large_image')
  assert.equal(twitter.site, BRAND.twitterSite)

  // Setting images suppresses app/twitter-image.*; the autofill supplies richer
  // values including twitter:image:alt.
  for (const key of ['title', 'description', 'images']) {
    assert.ok(!(key in twitter), `twitter.${key} should not be set`)
  }
})

test('twitter:creator is absent by default and set on request', () => {
  // `site` is the publisher, `creator` is the author. Defaulting creator to the
  // fleet handle misattributes authorship.
  assert.ok(!('creator' in site.metadata.twitter))
  assert.equal(
    defineSite({ ...options, twitterCreator: '@Someone' }).metadata.twitter.creator,
    '@Someone',
  )
})

test('robots asks for large image previews and drops the dead nocache key', () => {
  const { robots } = site.metadata
  assert.equal(robots.index, true)
  assert.equal(robots.follow, true)
  // The highest-value directive available here, and a precondition for Google
  // Discover eligibility.
  assert.equal(robots['max-image-preview'], 'large')
  // The resolver's `value !== false` filter drops it anyway — it read like a
  // decision while being dead code.
  assert.ok(!('nocache' in robots))
})

test('noIndex flips both directives and drops the preview hint', () => {
  assert.deepEqual(defineSite({ ...options, noIndex: true }).metadata.robots, {
    index: false,
    follow: false,
  })
})

test('unavailableAfter is coerced to ISO 8601', () => {
  const { robots } = defineSite({ ...options, unavailableAfter: '2026-12-31' }).metadata
  assert.equal(robots.unavailable_after, new Date('2026-12-31').toISOString())
  assert.throws(() => defineSite({ ...options, unavailableAfter: 'not a date' }), TypeError)
})

test('keywords and applicationName are gone entirely', () => {
  // keywords: ignored by Google since 2009, a spam signal to Bing, and one
  // identical keyword fleet-wide reads as low-quality templating.
  // applicationName: legacy Windows pinned tiles, superseded by manifest name.
  assert.ok(!('keywords' in site.metadata))
  assert.ok(!('applicationName' in site.metadata))
})

test('no manifest key — the file convention owns it', () => {
  // mergeStaticMetadata does a bare `if (manifest) { target.manifest = manifest }`,
  // so app/manifest.ts overwrites whatever we set. A default is dead code where
  // the convention exists and a link to a 404 where it does not.
  assert.ok(!('manifest' in site.metadata))
})

test('appleWebApp is titled with the short name, not the long one', () => {
  const named = defineSite({ ...options, shortName: 'Public Sans' })
  assert.equal(named.metadata.appleWebApp.title, 'Public Sans')
  assert.equal(named.metadata.appleWebApp.capable, true)
  // The resolver supplies statusBarStyle for any object-shaped value.
  assert.ok(!('statusBarStyle' in named.metadata.appleWebApp))
  assert.ok(!('appleWebApp' in defineSite({ ...options, appleWebApp: false }).metadata))
})

test('no icons block is emitted by default', () => {
  // Load-bearing absence. Next falls back to app/icon.* only when
  // `metadata.icons` is unset; any value suppresses app/icon.* and
  // app/apple-icon.* while app/favicon.ico survives — a half-broken icon set.
  assert.ok(!('icons' in site.metadata))
  assert.equal(
    defineSite({ ...options, icons: { icon: '/legacy.png' } }).metadata.icons.icon,
    '/legacy.png',
  )
})

test('alternates cannot be handed a partial that wipes the canonical', () => {
  const withFeed = defineSite({
    ...options,
    alternates: { types: { 'application/rss+xml': '/feed.xml' } },
  })
  assert.equal(withFeed.metadata.alternates.canonical, './')
  assert.equal(withFeed.metadata.alternates.types['application/rss+xml'], '/feed.xml')
})

test('openGraph options merge over the defaults rather than replacing them', () => {
  const { openGraph } = defineSite({ ...options, openGraph: { type: 'article' } }).metadata
  assert.equal(openGraph.type, 'article')
  assert.equal(openGraph.locale, 'en_AU')
  assert.equal(openGraph.siteName, options.title)
  assert.equal(openGraph.images.length, 1)
})

test('passthrough options only appear when supplied', () => {
  for (const key of ['verification', 'formatDetection', 'authors', 'other', 'pagination']) {
    assert.ok(!(key in site.metadata), `${key} should be absent`)
  }
  const full = defineSite({
    ...options,
    verification: { google: 'token' },
    formatDetection: { date: false },
    other: { 'msvalidate.01': 'bing-token' },
  })
  assert.equal(full.metadata.verification.google, 'token')
  assert.equal(full.metadata.formatDetection.date, false)
  assert.equal(full.metadata.other['msvalidate.01'], 'bing-token')
})

test('required options throw rather than producing a half-built object', () => {
  assert.throws(() => defineSite({ description: 'x', url: options.url }), TypeError)
  assert.throws(() => defineSite({ title: 'x', url: options.url }), TypeError)
  assert.throws(() => defineSite({ title: 'x', description: 'y' }), TypeError)
  assert.throws(() => defineSite(), TypeError)
})

test('a relative url throws, and names the bad value', () => {
  assert.throws(
    () => defineSite({ ...options, url: '/public-sans' }),
    (error) => error instanceof TypeError && error.message.includes('/public-sans'),
  )
})

test('no key anywhere holds undefined', () => {
  // A present-but-undefined key is not inert: mergeMetadata iterates with
  // for...in, so it resets the inherited value rather than leaving it alone.
  const walk = (value, path) => {
    if (Array.isArray(value)) return value.forEach((item, i) => walk(item, `${path}[${i}]`))
    if (value === null || typeof value !== 'object') return
    if (Object.getPrototypeOf(value) !== Object.prototype) return
    for (const [key, item] of Object.entries(value)) {
      assert.notEqual(item, undefined, `${path}.${key} is undefined`)
      walk(item, `${path}.${key}`)
    }
  }
  walk(defineSite({ ...options, openGraph: { title: undefined } }).metadata, 'metadata')
})

test('every defineSite call returns an independent object graph', () => {
  const first = defineSite(options)
  const second = defineSite(options)
  assert.deepEqual(first.metadata, second.metadata)
  assert.notEqual(first.metadata, second.metadata)

  first.metadata.openGraph.images[0].alt = 'mutated'
  assert.notEqual(second.metadata.openGraph.images[0].alt, 'mutated')
})

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

test('the viewport carries the brand theme colour as a single string', () => {
  assert.equal(site.viewport.themeColor, BRAND.themeColor)
  assert.equal(site.viewport.width, 'device-width')
  assert.equal(site.viewport.initialScale, 1)
})

test('colorScheme has no default because it describes the site CSS', () => {
  assert.ok(!('colorScheme' in site.viewport))
  assert.equal(
    defineSite({ ...options, viewport: { colorScheme: 'light dark' } }).viewport.colorScheme,
    'light dark',
  )
})

test('the viewport is compacted, so an undefined override cannot drop a default', () => {
  // mergeViewport's layout branch always overrides the target with the source
  // and is reached by for...in, so an own key holding undefined would win.
  const vp = defineSite({ ...options, viewport: { themeColor: undefined } }).viewport
  assert.equal(vp.initialScale, 1)
  assert.equal(vp.themeColor, BRAND.themeColor)
})

test('a viewport that would fail WCAG 1.4.4 throws', () => {
  // user-scalable=no is failure technique F69; maximumScale < 2 caps
  // enlargement below the required 200%. Next's own docs print maximumScale: 1
  // in a copy-pasteable example, which is exactly how this reaches a codebase.
  assert.throws(() => defineSite({ ...options, viewport: { userScalable: false } }), /1\.4\.4/)
  assert.throws(() => defineSite({ ...options, viewport: { maximumScale: 1 } }), /1\.4\.4/)
  assert.doesNotThrow(() => defineSite({ ...options, viewport: { maximumScale: 5 } }))
})

// ---------------------------------------------------------------------------
// page() and article()
// ---------------------------------------------------------------------------

test('page() emits no openGraph key at all', () => {
  // The whole reason defineSite exists. Any segment that sets openGraph
  // REPLACES the layout's entire block; og:title and og:description are
  // inherited from the page's own title/description for free.
  const page = site.page({ title: 'Guidance' })
  assert.ok(!('openGraph' in page))
  assert.equal(page.title.default, 'Guidance')
  assert.equal(page.alternates.canonical, './')
})

test('page() carries a title template so nested routes keep the suffix', () => {
  // The defect this replaced: resolveTitle returns `template: null` for a bare
  // string, and resolve-metadata stashes that null — so a plain-string title in
  // an INTERMEDIATE layout wiped the template for everything below it. A route
  // two levels deep rendered "Cards" while its parent rendered "Blocks | Site".
  //
  // `{ default, template }` is the shape that works: resolveTitle applies the
  // stashed parent template to `default`, so the segment keeps its own suffix,
  // while the template it carries keeps descendants working.
  const page = site.page({ title: 'Guidance' })
  assert.deepEqual(page.title, {
    default: 'Guidance',
    template: site.metadata.title.template,
  })
  assert.notEqual(typeof page.title, 'string')
})

test('page() supports an absolute title that opts out of the template', () => {
  // `absolute` wins outright and is never templated — but it still carries
  // `template`, so routes BELOW an absolute-titled segment are unaffected.
  const page = site.page({ title: { absolute: 'Page not found' } })
  assert.equal(page.title.absolute, 'Page not found')
  assert.equal(page.title.template, site.metadata.title.template)
  assert.ok(!('default' in page.title))
})

test('page() accepts its own template, for a sub-brand section', () => {
  const page = site.page({ title: 'Signature builder', titleTemplate: '%s | NSW Signatures' })
  assert.equal(page.title.template, '%s | NSW Signatures')
  assert.equal(page.title.default, 'Signature builder')
  assert.throws(() => site.page({ title: 'x', titleTemplate: 'no placeholder' }), TypeError)
  assert.throws(() => site.page({ title: 'x', titleTemplate: '%s | %s' }), TypeError)
})

test('page() restates the whole openGraph block when it overrides the image', () => {
  const page = site.page({ title: 'Guidance', image: '/guidance.png' })
  assert.equal(page.openGraph.images[0].url, '/guidance.png')
  // Must carry the site fields too, or setting an image would delete them.
  assert.equal(page.openGraph.siteName, options.title)
  assert.equal(page.openGraph.locale, 'en_AU')
})

test('page() robots stay complete when a page sets noIndex or an expiry', () => {
  assert.deepEqual(site.page({ title: 'Draft', noIndex: true }).robots, {
    index: false,
    follow: false,
  })
  // A page emitting robots replaces the layout's, so the preview hint has to
  // travel with it.
  const expiring = site.page({ title: 'Consultation', unavailableAfter: '2026-12-31' })
  assert.equal(expiring.robots['max-image-preview'], 'large')
  assert.equal(expiring.robots.unavailable_after, new Date('2026-12-31').toISOString())
})

test('article() emits the full openGraph block with the article fields', () => {
  const article = site.article({
    title: 'New guidance',
    description: 'What changed.',
    published: '2026-08-01',
    modified: new Date('2026-08-09'),
    section: 'Health',
    tags: ['guidance'],
  })
  assert.equal(article.openGraph.type, 'article')
  assert.equal(article.openGraph.siteName, options.title)
  assert.equal(article.openGraph.publishedTime, new Date('2026-08-01').toISOString())
  assert.equal(article.openGraph.modifiedTime, new Date('2026-08-09').toISOString())
  assert.equal(article.openGraph.section, 'Health')
  assert.deepEqual(article.openGraph.tags, ['guidance'])
})

test('page() and article() keep the site image, not the brand default', () => {
  // A site that configured its own social artwork must not silently revert to
  // the fleet image the moment a page or article restates the OpenGraph block.
  const custom = { url: '/social-preview.png', width: 1200, height: 630, alt: 'Custom' }
  const branded = defineSite({ ...options, image: custom })

  assert.equal(
    branded.article({ title: 'Guidance' }).openGraph.images[0].url,
    '/social-preview.png',
  )
  assert.equal(
    branded.page({ title: 'Guidance', image: '/page.png' }).openGraph.images[0].url,
    '/page.png',
  )
  // And a site with no image of its own still gets the brand default.
  assert.equal(site.article({ title: 'Guidance' }).openGraph.images[0].url, BRAND.ogImage.url)
})

test('image: false survives into page() and article()', () => {
  // The opt-out that re-enables app/opengraph-image.* must not be undone by a
  // page restating the block.
  const noImage = defineSite({ ...options, image: false })
  assert.ok(!('images' in noImage.article({ title: 'Guidance' }).openGraph))
})

test('article() works without a published date', () => {
  // Evergreen documentation legitimately uses og:type article with no date —
  // article:published_time is optional in the OpenGraph spec, and a docs page
  // reporting a date it does not have is worse than one reporting none.
  const article = site.article({ title: 'Getting started' })
  assert.equal(article.openGraph.type, 'article')
  assert.equal(article.openGraph.siteName, options.title)
  assert.ok(!('publishedTime' in article.openGraph))
  assert.ok(!('modifiedTime' in article.openGraph))
})

test('page() and article() require a title', () => {
  assert.throws(() => site.page({}), TypeError)
  assert.throws(() => site.page(), TypeError)
  assert.throws(() => site.article({ published: '2026-08-01' }), TypeError)
})
