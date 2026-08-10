// Post-release guard: the npm registry must match the newest release tag.
//
// semantic-release can partially fail — tag pushed and CHANGELOG committed, but the npm
// publish itself never landing — and the job can still look green. This repo publishes
// via OIDC trusted publishing, so the classic cause is a trusted publisher that is
// missing, pointed at the wrong workflow filename, or not yet configured because the
// package did not exist at the time. This script turns that state into a hard job
// failure: after semantic-release runs, npm's latest version must equal the newest v* tag.
//
// (Outright failures already turn the run red on their own. This guard covers the
// tagged-but-unpublished gap that would otherwise look green — exactly the state both
// @nswds config packages landed in on 2026-07-27: v1.0.0 tagged and changelogged, npm
// still serving the 0.0.0 bootstrap, and the next run reporting "no relevant changes".)
//
// Runs unconditionally on every release run — including pushes that legitimately release
// nothing (docs/chore) — so a tagged-but-unpublished gap left by an earlier run also
// turns the next run red instead of hiding behind "this push had nothing to release".

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Argument arrays rather than a shell string: no quoting or interpolation hazards,
// and nothing here needs a shell.
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim()

const { name } = JSON.parse(readFileSync('package.json', 'utf8'))

// Prereleases are skipped deliberately. `--sort=-v:refname` ranks v1.1.0-rc.1 ABOVE
// v1.0.1, but the npm lookup below reads the `latest` dist-tag, which a prerelease
// channel never moves. Comparing the two would fail a perfectly good release. If a
// prerelease channel is ever added, this needs to resolve that channel's dist-tag
// rather than `latest` — filtering here keeps it honest until then.
const tags = run('git', ['tag', '-l', 'v*', '--sort=-v:refname']).split('\n').filter(Boolean)
const latestTag = tags.find((tag) => !tag.includes('-'))

if (!latestTag) {
  console.log(
    tags.length
      ? `Only prerelease tags exist (${tags[0]}) — nothing to verify against the latest dist-tag.`
      : 'No release tags exist yet — nothing to verify.',
  )
  process.exit(0)
}

const expected = latestTag.slice(1)

// The registry can lag a fresh publish by seconds; poll before declaring failure.
const ATTEMPTS = 6
const DELAY_SECONDS = 15

// Retained so the final message can say WHY the lookup kept failing. Without it an
// E404 (genuinely unpublished — the case this guard exists for), a transient 5xx, and
// npm missing from PATH all look identical.
let lastError = ''
let lastPublished = ''

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  let published = ''
  try {
    published = run(npmCommand, ['view', name, 'version'])
    lastError = ''
  } catch (error) {
    // Could be propagation lag, so retry — but keep the reason for the final report.
    //
    // `||`, not `??`: a command can fail without writing to stderr at all, leaving it
    // an empty string. `??` only falls through on nullish, so it would keep that empty
    // string and discard the more useful error.message.
    //
    // String() because `||` selects a Buffer when one is present — Buffers are truthy —
    // and run() only yields a string stderr because it sets `encoding`. Wrapping keeps
    // this line correct even if that setting is ever dropped.
    lastError = String(error.stderr || error.message || error)
      .trim()
      .split('\n')[0]
  }
  // Only overwrite on a real reading — a failed retry must not erase a version we
  // already observed, or the final report claims "unavailable" when it is not.
  if (published) lastPublished = published

  if (published === expected) {
    console.log(`✅ npm has ${name}@${published}, matching the latest tag (${latestTag}).`)
    process.exit(0)
  }

  console.log(
    `npm latest is ${published || 'unavailable'}, expected ${expected} (attempt ${attempt}/${ATTEMPTS})`,
  )
  if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, DELAY_SECONDS * 1000))
}

// State both sides rather than asserting a direction: npm can also be AHEAD of the tag
// (someone published by hand), and "the registry is behind" would then send whoever is
// debugging in the wrong direction.
console.error(
  [
    `❌ ${name}: npm and the repo disagree.`,
    `   newest release tag: ${latestTag} (expected npm ${expected})`,
    `   npm latest dist-tag: ${lastPublished || 'unavailable'}`,
    lastError ? `   last npm error: ${lastError}` : '',
    '',
    '   If npm is missing the version, the publish did not land: check the semantic-release',
    '   output, and confirm this package has a trusted publisher pointing at this repo and',
    '   release.yml. If npm is ahead, a version was published outside the release workflow.',
  ]
    .filter(Boolean)
    .join('\n'),
)
process.exit(1)
