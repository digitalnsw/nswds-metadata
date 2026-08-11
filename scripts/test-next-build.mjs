// Build the fixture app and assert the manifest route actually rendered.
//
// This is the only check that can reach Next's metadata route loader, which
// emits `if (typeof handler !== 'function') throw new Error('Default export is
// missing in …')` and then calls `handler()`. `node --test` cannot: it can
// prove `site.manifest` is a function, but not that Next accepts it as an
// app/manifest.ts default export. If that contract ever breaks, it breaks
// every consumer's build with an error that names the wrong cause.
//
// It also asserts on the rendered HTML of TWO routes, because the resolver's
// merge and URL-resolution behaviour is invisible from a single route.
//
// The fixture resolves `@nswds/metadata` through a node_modules symlink to the
// repo root, so it goes through the real `exports` map — the same path a
// consumer takes — rather than a relative import that would bypass it.
//
// The fixture deliberately has NO package.json. If one appears, `next build`
// could not resolve a type package and installed it — and that nested
// `npm install` prunes the symlink below as extraneous, so the next run fails
// with a bare "Cannot find module '@nswds/metadata'" that names the wrong
// cause. `@types/node`, `@types/react` and `@types/react-dom` are root
// devDependencies purely to keep that from happening; the assertions at the
// end of this script catch it if it ever does.

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = join(repoRoot, 'fixtures', 'next-app')
const linkDir = join(fixture, 'node_modules', '@nswds')
const link = join(linkDir, 'metadata')

function linkPackageIntoFixture() {
  // Rebuilt every run: a stale link left by an earlier layout would silently
  // test the wrong tree.
  rmSync(link, { recursive: true, force: true })
  mkdirSync(linkDir, { recursive: true })
  symlinkSync(repoRoot, link, 'dir')
}

/** A named prerendered page, for asserting on the emitted <head>. */
function findRenderedHtml(dir, filename) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      const found = findRenderedHtml(full, filename)
      if (found) return found
    } else if (entry.name === filename) {
      return readFileSync(full, 'utf8')
    }
  }
  return null
}

/** Pull one tag's attribute out of rendered HTML. */
function attr(html, pattern) {
  const match = html.match(pattern)
  return match ? match[1] : null
}

/** Walk .next for the rendered manifest body, wherever this Next version put it. */
function findManifestBody(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    // Do not follow the symlink we just created back into the repo.
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) findManifestBody(full, found)
    else if (entry.name.startsWith('manifest.webmanifest')) found.push(full)
  }
  return found
}

linkPackageIntoFixture()

const nextBin = join(repoRoot, 'node_modules', '.bin', 'next')
rmSync(join(fixture, '.next'), { recursive: true, force: true })

console.log('Building fixtures/next-app…')
execFileSync(nextBin, ['build'], {
  cwd: fixture,
  stdio: 'inherit',
  // Next warns and changes behaviour based on NODE_ENV; let it set its own.
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
})

// Diagnose the self-inflicted failure before reporting on the manifest, so the
// error names the real cause rather than the symptom.
if (existsSync(join(fixture, 'package.json'))) {
  console.error(
    '❌ next build wrote a package.json into the fixture, which means it installed\n' +
      '   a missing type package — and that nested npm install prunes the\n' +
      "   @nswds/metadata symlink. Add whatever it installed to the ROOT package's\n" +
      '   devDependencies, then delete fixtures/next-app/package{,-lock}.json.',
  )
  process.exit(1)
}

if (!existsSync(link)) {
  console.error('❌ The @nswds/metadata symlink vanished during the build. See the note above.')
  process.exit(1)
}

const candidates = findManifestBody(join(fixture, '.next'))
if (candidates.length === 0) {
  console.error(
    '❌ next build produced no manifest.webmanifest output.\n' +
      '   The app/manifest.ts route did not render. Check that `site.manifest`\n' +
      '   is still a FUNCTION — see next-metadata-route-loader.js.',
  )
  process.exit(1)
}

let manifest
let source
for (const candidate of candidates) {
  if (statSync(candidate).isDirectory()) continue
  try {
    manifest = JSON.parse(readFileSync(candidate, 'utf8'))
    source = candidate
    break
  } catch {
    // .meta sidecars and similar live alongside the body; keep looking.
  }
}

if (!manifest) {
  console.error(
    `❌ Found manifest output but none of it parsed as JSON:\n${candidates
      .map((path) => `   ${relative(fixture, path)}`)
      .join('\n')}`,
  )
  process.exit(1)
}

const failures = []
const expect = (condition, message) => {
  if (!condition) failures.push(message)
}

expect(manifest.name === 'Fixture', `name was ${JSON.stringify(manifest.name)}, expected "Fixture"`)
expect(manifest.theme_color === '#002664', `theme_color was ${manifest.theme_color}`)
expect(manifest.background_color === '#FFFFFF', `background_color was ${manifest.background_color}`)
expect(manifest.lang === 'en-AU', `lang was ${manifest.lang}`)
expect(manifest.start_url === '/', `start_url was ${manifest.start_url}`)
expect(manifest.id === '/', `id was ${manifest.id}`)
// The fixture models the fleet default: icons come from the app/ file
// conventions, so the manifest deliberately carries none. A manifest icon has
// to be a stably-named file in public/, which app/icon.svg is not.
expect(!('icons' in manifest), 'the manifest should carry no icons by default')

// The icon-suppression regression. The fixture ships app/favicon.ico,
// app/icon.svg and app/apple-icon.png; Next only emits tags for icon.svg and
// apple-icon.png when `metadata.icons` is unset, because resolve-metadata.js
// guards that fallback with `if (!resolvedMetadata.icons)`. (favicon.ico is
// unshifted unconditionally, so it survives either way — which is exactly why
// eyeballing the tab icon is not enough to catch this.) If defineSite ever
// grows an icons default again, two of these three vanish silently, with no
// build error and no runtime error.
const html = findRenderedHtml(join(fixture, '.next'), 'index.html')
const nested = findRenderedHtml(join(fixture, '.next'), 'guidance.html')
const deep = findRenderedHtml(join(fixture, '.next'), 'detail.html')
if (!html || !nested || !deep) {
  console.error(
    '❌ next build produced no rendered HTML to assert against' +
      `${html ? ' for the nested /guidance route' : ''}.`,
  )
  process.exit(1)
}

// --- P0: canonical and og:url must resolve per-route -----------------------
// Unprovable from a single route: at `/` the homepage's canonical and the site
// root are the same string, so a broken `'/'` default looks correct. The
// nested route is the only place the bug is visible.
const rootCanonical = attr(html, /<link rel="canonical" href="([^"]*)"/)
const nestedCanonical = attr(nested, /<link rel="canonical" href="([^"]*)"/)
expect(rootCanonical !== null, 'the root page emitted no canonical at all')
expect(
  nestedCanonical !== rootCanonical,
  `/guidance canonical (${nestedCanonical}) equals the homepage's (${rootCanonical}) — ` +
    "the './' default has regressed to '/', so every page claims the homepage as canonical",
)
expect(
  String(nestedCanonical).endsWith('/guidance'),
  `/guidance canonical was ${nestedCanonical}, expected it to end with /guidance`,
)

const nestedOgUrl = attr(nested, /<meta property="og:url" content="([^"]*)"/)
expect(
  String(nestedOgUrl).endsWith('/guidance'),
  `/guidance og:url was ${nestedOgUrl} — scrapers use it as the share's identity, ` +
    'so a site-root value collapses every page into one card',
)

// --- The page() contract ---------------------------------------------------
// site.page() emits no openGraph key, so og:title comes from the page's own
// title via inheritFromMetadata while og:site_name is inherited from the layout.
expect(
  attr(nested, /<meta property="og:title" content="([^"]*)"/) === 'Guidance | Fixture',
  `/guidance og:title was ${attr(nested, /<meta property="og:title" content="([^"]*)"/)}`,
)
expect(
  attr(nested, /<meta property="og:site_name" content="([^"]*)"/) === 'Fixture',
  'the nested route lost og:site_name — a page-level openGraph key replaced the layout block',
)

// --- The title template must survive an intermediate layout ----------------
// Only observable two levels deep. resolveTitle returns `template: null` for a
// bare-string title, and resolve-metadata stashes that null — so a plain string
// in /guidance/layout.tsx would wipe the suffix for everything below it, and
// /guidance/detail would render "Detail" instead of "Detail | Fixture".
const deepTitle = attr(deep, /<title[^>]*>([^<]*)<\/title>/)
expect(
  deepTitle === 'Detail | Fixture',
  `/guidance/detail <title> was ${JSON.stringify(deepTitle)}, expected "Detail | Fixture" — ` +
    'the title template did not survive the intermediate layout',
)
const nestedTitle = attr(nested, /<title[^>]*>([^<]*)<\/title>/)
expect(
  nestedTitle === 'Guidance | Fixture',
  `/guidance <title> was ${JSON.stringify(nestedTitle)}, expected "Guidance | Fixture"`,
)

// --- Removals and additions ------------------------------------------------
expect(!/<meta name="keywords"/.test(html), 'a keywords meta is being emitted again')
expect(
  /<meta name="robots" content="[^"]*max-image-preview:large/.test(html),
  `robots was ${attr(html, /<meta name="robots" content="([^"]*)"/)}, expected max-image-preview:large`,
)
expect(
  !/<meta name="application-name"/.test(html),
  'an application-name meta is being emitted again',
)
expect(
  /<meta name="twitter:card" content="summary_large_image"/.test(html),
  'twitter:card is not summary_large_image — dropping it downgrades every link to a small square card',
)

const iconTags = html.match(/<link[^>]*rel="(?:icon|apple-touch-icon)"[^>]*>/g) ?? []
const hasHashedIcon = iconTags.some((tag) => /href="\/icon\.svg\?/.test(tag))
const hasHashedApple = iconTags.some((tag) => /href="\/apple-icon\.png\?/.test(tag))
// Hashed like the others. The Next docs show a bare `href="/favicon.ico"` for
// this convention, but 16.3.0 content-hashes it too — do not tighten this to an
// exact match on the strength of the docs.
const hasFavicon = iconTags.some((tag) => /href="\/favicon\.ico\?/.test(tag))

expect(
  hasHashedIcon && hasHashedApple && hasFavicon,
  'the app/favicon.ico, app/icon.svg and app/apple-icon.png tags are not all present — ' +
    'setting `metadata.icons` suppresses the file conventions rather than merging with them.\n' +
    `   Found: ${iconTags.length ? iconTags.join('\n          ') : '(no icon tags at all)'}`,
)

if (failures.length > 0) {
  console.error('❌ The rendered output is not what defineSite should produce:')
  for (const failure of failures) console.error(`   ${failure}`)
  process.exit(1)
}

console.log(
  `✅ next build rendered ${relative(fixture, source)} as "${manifest.name}" with theme_color ${manifest.theme_color}.`,
)
console.log('✅ the app/favicon.ico, icon.svg and apple-icon.png conventions emitted their tags.')
console.log(
  `✅ canonical resolves per route: / → ${rootCanonical}, /guidance → ${nestedCanonical}.`,
)
console.log('✅ site.page() inherits og:site_name while getting its own og:title.')
console.log(
  `✅ the title template survives an intermediate layout: /guidance → "${nestedTitle}", /guidance/detail → "${deepTitle}".`,
)
