# @nswds/metadata

Shared Next.js App Router metadata, viewport and web app manifest for the
digitalnsw fleet.

Every site was hand-rolling its own `metadata` block and they had drifted: most
carried no `metadataBase`, none exported a `viewport`, and several were quietly
telling search engines that every page on the site was the homepage. The
defaults that should be identical across every NSW Government service now live
in one versioned place; the fields that genuinely differ stay arguments.

Everything here is checked against Next 16.3.0's `dist/`, not its prose docs,
which are wrong in several places that matter — noted inline where relevant.

A consuming repo holds exactly one module that calls `defineSite` — by
convention `lib/site.ts`. The root layout takes `metadata` and `viewport` from
it; `app/manifest.ts` and individual pages take what they need from the same
object. See [Use](#use) for the full shape.

## Install

```sh
npm install @nswds/metadata
```

`next` is a required peer (`>=15`). The package imports nothing from it at
runtime — it is object literals all the way down — but its whole type surface is
Next's, so a Next-less install fails loudly rather than at first `tsc`.

## Use

One entry point. Define the site once, in its own module:

```ts
// lib/site.ts
import { defineSite } from '@nswds/metadata'

export const site = defineSite({
  title: 'Public Sans (NSW) Download',
  description: 'Download Public Sans, the official NSW Government typeface.',
  url: 'https://public-sans.digital.nsw.gov.au/',
})
```

Then use it from the three places Next asks for metadata:

```tsx
// app/layout.tsx
export const { metadata, viewport } = site
```

```ts
// app/manifest.ts
export default site.manifest
```

```tsx
// app/guidance/page.tsx
export const metadata = site.page({ title: 'Guidance' })
```

Three options are required — `title`, `description`, `url`. Everything else has
a fleet default: `metadataBase`, the title template, OpenGraph with `en_AU` and
the NSW image, a `summary_large_image` Twitter card, `robots` with
`max-image-preview:large`, a self-resolving canonical, and `appleWebApp`.

Do **not** annotate the exports as `: Metadata`. Next's type plugin does not
check `export const metadata`, so the annotation adds nothing and reintroduces
the `import type` line this package exists to delete.

### Why there is no `createMetadata`

Because a page cannot safely write its own metadata object. Next **replaces**
`openGraph` and `twitter` wholesale for any segment that sets them — so this,
which looks obviously correct, silently deletes the layout's entire OpenGraph
block:

```tsx
// DON'T
export const metadata = { openGraph: { type: 'article' } }
```

`site.page()` and `site.article()` cannot make that mistake. `page()` emits **no
`openGraph` key at all**, because `og:title` and `og:description` are inherited
from the page's own title and description for free. `article()` restates the
whole block before adding the `article:*` fields, which is the only safe way to
set them.

```tsx
export const metadata = site.article({
  title: 'New guidance for pharmacists',
  description: 'What changed and when it takes effect.',
  published: '2026-08-01',
  modified: '2026-08-09', // often the most important fact on a government page
  section: 'Health',
})
```

### Titles below the root

`site.page()` returns `{ default, template }` rather than a bare string, and that
shape is load-bearing. `resolveTitle` returns `template: null` for a string, and
Next stashes that null — so a plain-string title in an _intermediate_ layout
wipes the template for **everything below it**, and a route two levels deep
renders `Cards` instead of `Cards | Site`.

Two escape hatches:

```tsx
// Opts out of the template for this segment; routes below it are unaffected.
site.page({ title: { absolute: 'Page not found' } })

// A sub-brand section: its own template, for this segment and everything below.
site.page({ title: 'Signature builder', titleTemplate: '%s | NSW Signatures' })
```

### Escape hatch

`site.metadata` is a plain object, so anything the options do not cover is a
spread:

```tsx
export const metadata = {
  ...site.metadata,
  alternates: { canonical: './', languages: { 'en-AU': '/' } },
}
```

Note the asymmetry: `openGraph` passed to `defineSite` is shallow-**merged** over
the computed defaults, so `openGraph: { type: 'article' }` keeps `locale`,
`siteName` and `images`. That is true of _our_ argument and untrue of Next's
segment merging — see above.

## Icons: leave them to the file conventions

**Three files, in `app/`. Nothing in `public/`. Nothing else, anywhere.**

| File                 | Spec                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| `app/favicon.ico`    | single 32×32 frame, 1–5 KB                                                              |
| `app/icon.svg`       | square viewBox, dark mode via inline `@media (prefers-color-scheme: dark)`, no `<text>` |
| `app/apple-icon.png` | **180×180, fully opaque**, no pre-rounded corners                                       |

That set emits exactly this, content-hashed, with `sizes` and `type` derived
from the files themselves:

```html
<link rel="icon" href="/favicon.ico?<hash>" sizes="32x32" type="image/x-icon" />
<link rel="icon" href="/icon.svg?<hash>" sizes="any" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-icon.png?<hash>" sizes="180x180" type="image/png" />
```

**`defineSite` emits no `icons` key, and you should almost never set one.**
Setting `metadata.icons` does not add to the file conventions — it suppresses
them:

```js
if (leafSegmentStaticIcons.icon.length > 0 || …apple.length > 0) {
  if (!resolvedMetadata.icons) { …unshift the static icons… }
}
// next/dist/lib/metadata/resolve-metadata.js:812
```

The failure is **partial, which makes it harder to notice**: the favicon is
unshifted unconditionally at `:660`, so `app/favicon.ico` survives while
`icon.svg` and `apple-icon.png` emit nothing. Your tab icon still looks right;
only the Slack card is wrong. `icons: null` is safe (the guard stays falsy);
`icons: {}` suppresses everything and emits no tags at all.

`fixtures/next-app` asserts on every build that all three tags survive.

**Why keep `favicon.ico` when every browser reads the SVG?** It is the only icon
that answers a bare `/favicon.ico` request — feed readers, link-preview
scrapers, security scanners and uptime dashboards fetch that path without ever
parsing your HTML.

**Dark mode belongs inside the SVG**, never in an `icons[].media` descriptor:
`media` on `<link rel=icon>` was never reliably implemented, browsers resolve
the favicon once at parse time, and reaching for it costs you the other two files.

**Dead, do not add:** `mask-icon` (Safari stopped using it in Safari 12),
`msapplication-*` and `browserconfig.xml` (Windows 8 tiles via retired
browsers), `rel="shortcut icon"`, `apple-touch-icon-precomposed` (Next warns),
numbered `icon0…9.png` (the suffix is a single digit — `icon10.png` is a silent
no-op), and `app/apple-icon.svg` (extension not allowed, silently ignored).
`shortcut icon` and `mask-icon` are worse than merely dead: both fall outside
Next's streaming-metadata reinsert selector, so they strand in `<body>`.

## Manifest icons are a separate problem

`site.manifest` carries **no icons by default**. A manifest icon has to be a
stably-named file, and no file-convention icon can ever be one — every static
metadata image gets `?<16-hex-digest>` appended, unconditionally. The
conventions also cannot express `purpose: 'maskable'`, which Android's launcher
needs.

So a site that wants an install-prompt icon ships real PNGs in `public/` and
opts in:

```ts
import { defineSite, manifestIcons } from '@nswds/metadata'

export const site = defineSite({
  title: '…',
  description: '…',
  url: '…',
  manifest: { icons: manifestIcons() },
})
```

`manifestIcons()` expects `icon-192.png`, `icon-512.png`,
`icon-maskable-192.png`, `icon-maskable-512.png` and `icon.svg` in `public/`.
Without them, leave it unset: an empty manifest and one full of 404s look
identical to the browser, but the empty one is honest.

**Manifest ownership runs the opposite way to icons.** `mergeStaticMetadata`
does a bare `if (manifest) { target.manifest = manifest }`, so `app/manifest.ts`
overwrites any `metadata.manifest` value. That is why this package sets none —
a default would be dead code where the route exists and a link to a 404 where it
does not.

## What this deliberately does not emit

Each of these is a decision, recorded so nobody re-adds it:

| Field                                                                             | Why not                                                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `keywords`                                                                        | Ignored by Google since 2009, a spam signal to Bing. One identical keyword fleet-wide reads as low-quality templating.                     |
| `applicationName`                                                                 | Legacy Windows pinned tiles. Superseded by the manifest `name`.                                                                            |
| `robots.notranslate`                                                              | Tells Google not to offer translation. Indefensible for a NSW audience.                                                                    |
| `viewport.userScalable` / `maximumScale`                                          | `user-scalable=no` and a max scale under 2 fail WCAG 2.2 SC 1.4.4 (F69). **Passing either throws.**                                        |
| `manifest.orientation`                                                            | Locking an installed app to portrait fails SC 1.3.4, and only manifests in the _installed_ app — so it survives every browser-based audit. |
| `classification`                                                                  | Reads like the NSW information-classification scheme. A protective marking in the HTML of a public page is a leak.                         |
| `generator`                                                                       | Publishing the exact stack of a government site. Next does not set it; the omission is deliberate.                                         |
| `referrer`                                                                        | Real directive, wrong layer — `Referrer-Policy` as an HTTP header covers images, JSON and downloads too.                                   |
| `creator`, `publisher`, `category`, `abstract`, `archives`, `assets`, `bookmarks` | Unregistered or unconsumed link types and meta names.                                                                                      |
| `facebook`, `itunes`, `appLinks`                                                  | Bind the page to a third-party app for no rendering benefit.                                                                               |
| `pinterest`                                                                       | Non-functional in 16.3.0 — Next emits `property=` where the spec wants `name=`.                                                            |
| `themeColor`, `colorScheme`, `viewport` on `Metadata`                             | Dead. No branch of the emitter reads them; they emit nothing and warn once per render. Use the `viewport` export.                          |

Two live traps worth knowing even though the package handles them:
`formatDetection.telephone: false` kills iOS tap-to-call on the very pages that
exist to generate calls (exposed, never defaulted), and `robots: { noindex: true }`
— the natural spelling — is typed `never`, emits **no robots tag at all**, and
leaves the page indexed. Use `noIndex: true`.

## A caveat on theme colour

`viewport.themeColor` and the manifest's `theme_color` are both `#002664`, and
the test suite checks them against each other. A manifest theme colour **cannot**
be media-dependent, so a site that overrides the viewport with a light/dark array
will always disagree with its own installed chrome. Deliberate trade, not an
oversight.

## Why there is no build step

The published files are `index.mjs` and a hand-written `index.d.mts`, shipped
as-is — the same shape as `@nswds/eslint-config` and `@nswds/prettier-config`.

Those two ship no types at all, which works because neither is ever
type-checked. This package is imported from `app/layout.tsx` in repos that are
all `strict: true`, where an untyped module is a hard TS7016 error. So types are
mandatory here, and hand-writing them is what keeps the no-build-step property.
A generated `.d.ts` committed to the repo is a build step in disguise, and
drifts silently.

## Tests

```sh
npm test           # node --test — the returned objects
npm run typecheck  # tsc --noEmit — the shipped declarations
npm run test:build # a real `next build` over fixtures/next-app
```

`test:build` is the only check that can reach Next's metadata route loader and
the resolver's merge behaviour. It asserts on the rendered HTML of two routes,
because the canonical fix is invisible from a single route: at `/` a correct
`'./'` and a broken `'/'` produce the same string.

**Debugging note:** a plain `curl` reproduces the _browser_ streaming path, where
metadata renders into `<body>` and is relocated by an injected script. To see
what Slack or Facebook actually receive, send a bot UA:

```sh
curl -sA 'facebookexternalhit/1.1' https://site.nsw.gov.au/ | grep -E 'og:|twitter:|rel="icon"'
```

An absent User-Agent takes the streaming path, not the crawler path.

## Releases

semantic-release, on merge to `main`. Publishing is npm OIDC trusted publishing
— there is no `NPM_TOKEN` secret in this repo.

## Shared tooling

This repo is in **group 2c** of the
[nswds-devops](https://github.com/digitalnsw/nswds-devops) file sync: the shell
scripts in `scripts/`, the commit-type configs, `.npmrc`, `.nvmrc`,
`renovate.json` and most of `.github/workflows/` are owned there and overwritten
on sync. Do not edit them here.

`ci.yml`, `release.yml`, `release.config.mjs` and
`scripts/verify-release-published.mjs` are deliberately repo-owned — group 2c
exists precisely so the sync does not overwrite them and disable trusted
publishing.
