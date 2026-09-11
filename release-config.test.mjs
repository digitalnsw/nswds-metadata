import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeCommits } from '@semantic-release/commit-analyzer'

import releaseConfig from './release.config.mjs'

/**
 * What release does a given commit actually produce?
 *
 * Runs the REAL config through the REAL analyzer rather than asserting on the
 * shape of `parserOpts`, because that is the level at which this bug was
 * invisible: the keyword list looked entirely reasonable.
 *
 * semantic-release bundles conventional-commits-parser v6, whose default note
 * regex accepts a SPACE where the Conventional Commits footer requires a colon.
 * An ordinary body line beginning "breaking changes ..." therefore declared a
 * breaking change and took the rest of the sentence as its description. It
 * shipped digitalnsw/engagement v2.0.0 and digitalnsw/nswds-email v3.0.0.
 * `notesPattern` in the config requires the colon.
 *
 * This package publishes to npm, so a false major reaches real consumers.
 * Commitlint cannot stand in for this: it resolves parser v7, which already
 * requires the colon, so it parses these messages differently from the tool
 * that acts on them.
 */
const pluginConfig = releaseConfig.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === '@semantic-release/commit-analyzer',
)[1]

const logger = { log() {}, error() {}, warn() {} }

function releaseTypeFor(message) {
  return analyzeCommits(pluginConfig, {
    commits: [{ hash: '0000000', message, subject: message.split('\n')[0] }],
    logger,
    cwd: process.cwd(),
  })
}

test('prose about breaking things is not a breaking change', async () => {
  // The sentence that cost engagement v2.0.0 was saying nothing broke.
  for (const word of ['breaking', 'Breaking', 'BREAKING']) {
    const message = [
      'fix(deps): update dependency resend to v6',
      '',
      'The upstream notes list several changes.',
      word + ' changes across v5 and v6 do not affect this repo.',
    ].join('\n')

    assert.notEqual(await releaseTypeFor(message), 'major', word + ' changes must stay prose')
  }
})

test('the hyphenated synonym is prose unless it is a footer', async () => {
  // A keyword now, so the phrase in ordinary prose must stay prose.
  const message = [
    'fix(a): tidy the guard',
    '',
    'Some context first.',
    'breaking-change handling is unchanged here.',
  ].join('\n')

  assert.notEqual(await releaseTypeFor(message), 'major')
})

test('the footers still declare a breaking change', async () => {
  for (const keyword of ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING-CHANGE', 'BREAKING']) {
    const message = ['feat(api): move the endpoint', '', keyword + ': the old path is gone.'].join(
      '\n',
    )

    assert.equal(await releaseTypeFor(message), 'major', keyword + ' must release a major')
  }
})

test('a bulleted footer in a squashed body still counts', async () => {
  // A squashed PR body arrives with `* ` prefixes, which the leading `[\s|*]*`
  // in notesPattern exists to allow.
  const message = ['feat(api): move the endpoint', '', '* BREAKING CHANGE: gone.'].join('\n')

  assert.equal(await releaseTypeFor(message), 'major')
})

test('a lowercase footer still counts, deliberately', async () => {
  // Off-spec but unambiguous. Missing a real breaking change is worse than the
  // prose this costs, so notesPattern keeps the parser's case-insensitivity.
  const message = ['feat(api): move the endpoint', '', 'breaking change: gone.'].join('\n')

  assert.equal(await releaseTypeFor(message), 'major')
})

test('the bang header still declares a breaking change', async () => {
  assert.equal(await releaseTypeFor('feat(api)!: drop the old endpoint'), 'major')
})

test('ordinary commits release what their type says', async () => {
  assert.equal(await releaseTypeFor('fix(a): correct the guard'), 'patch')
  assert.equal(await releaseTypeFor('feat(a): add the guard'), 'minor')
})
