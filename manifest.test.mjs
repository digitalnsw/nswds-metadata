import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BRAND, defineSite, manifestIcons } from './index.mjs'

const options = {
  title: 'Public Sans (NSW) Download',
  description: 'Download Public Sans, the official NSW Government typeface.',
  url: 'https://public-sans.digital.nsw.gov.au/',
}

const site = defineSite(options)

// The PNGs a consumer must serve from public/ for the manifest to have icons.
// A manifest icon cannot point at app/icon.svg — Next serves the file
// conventions at a content-hashed URL (/icon.svg?<16-hex>), which is not stable
// enough to hard-code. Missing manifest icons are dropped silently, falling
// back to a screenshot of the page in the install prompt.
const MANIFEST_ASSETS = new Set([
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/icon.svg',
])

test('site.manifest is a zero-argument function', () => {
  // Next's metadata route loader emits
  //   if (typeof handler !== 'function') throw new Error('Default export is missing in …')
  // and then calls handler() with no arguments. If this regresses, every
  // consumer's build breaks with a message that names the wrong cause.
  assert.equal(typeof site.manifest, 'function')
  assert.equal(site.manifest.length, 0)
})

test('the manifest inherits the site identity', () => {
  const manifest = site.manifest()
  assert.equal(manifest.name, options.title)
  assert.equal(manifest.short_name, options.title)
  assert.equal(manifest.description, options.description)
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.id, '/')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.lang, 'en-AU')
  assert.equal(manifest.dir, 'ltr')
  assert.equal(manifest.background_color, BRAND.backgroundColor)
})

test('shortName drives both the manifest label and the apple web app title', () => {
  // Both are rendered as a home-screen label and truncate past ~12 characters,
  // so they must be the same string.
  const named = defineSite({ ...options, shortName: 'Public Sans' })
  assert.equal(named.manifest().short_name, 'Public Sans')
  assert.equal(named.metadata.appleWebApp.title, 'Public Sans')
})

test('lang is the hyphenated BCP 47 tag, not the OpenGraph locale', () => {
  // 'en_AU' is invalid BCP 47 and silently ignored — the manifest is
  // JSON.stringify'd verbatim with no validation.
  assert.equal(site.manifest().lang, 'en-AU')
  assert.equal(site.metadata.openGraph.locale, 'en_AU')
})

test('id defaults to scope so a later start_url change updates rather than duplicates', () => {
  const moved = defineSite({ ...options, manifest: { startUrl: '/thing/' } })
  assert.equal(moved.manifest().scope, '/thing/')
  assert.equal(moved.manifest().id, '/thing/')

  const pinned = defineSite({ ...options, manifest: { startUrl: '/thing/', id: '/' } })
  assert.equal(pinned.manifest().id, '/')
})

test('the manifest has no icons unless the site supplies them', () => {
  // Nothing honest to default to: app/icon.svg is content-hashed and
  // app/apple-icon.png is not a manifest icon. A list of 404s would be worse
  // than an empty manifest — browsers drop missing icons silently either way.
  assert.ok(!('icons' in site.manifest()))

  const withIcons = defineSite({ ...options, manifest: { icons: manifestIcons() } })
  assert.equal(withIcons.manifest().icons.length, 5)
})

test('orientation is never emitted, at any input', () => {
  // Locking an installed app to portrait fails WCAG 2.2 SC 1.3.4 and excludes
  // users with a device mounted to a wheelchair or stand. Because it only
  // manifests in the INSTALLED app, it survives every browser-based audit.
  const forced = defineSite({ ...options, manifest: { orientation: 'portrait' } })
  assert.ok(!('orientation' in forced.manifest()))
})

test('manifestIcons is five entries, with any and maskable as separate files', () => {
  const icons = manifestIcons()
  assert.equal(icons.length, 5)
  assert.ok(icons.some((icon) => icon.purpose === 'any'))
  assert.ok(icons.some((icon) => icon.purpose === 'maskable'))

  // A maskable icon has ~40% padding baked in. One file declaring
  // "any maskable" renders a small mark adrift in a large box everywhere that
  // is not Android's launcher.
  for (const icon of icons) {
    assert.ok(!String(icon.purpose).includes(' '), `${icon.src} declares a combined purpose`)
  }
})

test('every manifestIcons path is a real asset', () => {
  for (const icon of manifestIcons()) {
    assert.ok(MANIFEST_ASSETS.has(icon.src), `${icon.src} is not in the known asset set`)
  }
})

test('manifestIcons prefixes every icon for a sub-path deployment', () => {
  for (const icon of manifestIcons('/thing/')) assert.ok(icon.src.startsWith('/thing/'))
  // A base without the trailing slash must not produce `/thingicon.svg`.
  for (const icon of manifestIcons('/thing')) assert.ok(icon.src.startsWith('/thing/'))
})

test('the optional manifest members pass through', () => {
  const rich = defineSite({
    ...options,
    manifest: {
      screenshots: [{ src: '/wide.png', sizes: '1280x720', form_factor: 'wide' }],
      shortcuts: [{ name: 'Download', url: '/download' }],
      categories: ['government'],
    },
  })
  const manifest = rich.manifest()
  assert.equal(manifest.screenshots.length, 1)
  assert.equal(manifest.shortcuts[0].url, '/download')
  assert.deepEqual(manifest.categories, ['government'])
})

test('the manifest round-trips through JSON unchanged', () => {
  // The route serialises this. A URL, a Date or an undefined leaking in would
  // change shape between the object and the served file.
  const manifest = defineSite({ ...options, manifest: { icons: manifestIcons() } }).manifest()
  assert.deepEqual(JSON.parse(JSON.stringify(manifest)), manifest)
})

test('every invocation returns an independent object', () => {
  const withIcons = defineSite({ ...options, manifest: { icons: manifestIcons() } })
  const first = withIcons.manifest()
  const second = withIcons.manifest()

  assert.deepEqual(first, second)
  assert.notEqual(first, second)

  first.icons[0].src = '/mutated.png'
  assert.notEqual(second.icons[0].src, '/mutated.png')
})

test('an empty manifest name throws at defineSite, not at request time', () => {
  assert.throws(
    () => defineSite({ ...options, manifest: { name: '' } }),
    (error) => error instanceof TypeError && error.message.includes('manifest.name'),
  )
  assert.throws(
    () => defineSite({ ...options, manifest: { shortName: '  ' } }),
    (error) => error instanceof TypeError && error.message.includes('manifest.shortName'),
  )
})

test('the manifest theme colour matches the viewport meta tag', () => {
  // These are two different files in the built output. If they disagree, the
  // browser chrome changes colour the moment a user installs the app.
  assert.equal(site.manifest().theme_color, site.viewport.themeColor)
})
