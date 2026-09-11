// breakingHeaderPattern is a DEFENSIVE FALLBACK for the `type!:` bang. It was
// load-bearing when it was added: the bundled parser did not honour the bang on
// its own, and a `feat!:` shipped as a MINOR — that is how a breaking change
// went out as @nswds/tokens v2.33.0 (nswds-tokens#79).
//
// On the current dependency set it no longer is. Deleting it leaves `feat!:`
// still majoring on semantic-release 25.0.9, because the conventionalcommits
// preset now handles the bang itself. Keep it for the version that stops doing
// so — but the thing to re-verify when upgrading semantic-release is that
// `feat!:` still majors, not that this line is what makes it.
const parserOpts = {
  // `BREAKING-CHANGE` is the Conventional Commits spec's synonym for
  // `BREAKING CHANGE`. The preset honours it by default; replacing the default
  // with this hand-written list dropped it, so a correctly written
  // `BREAKING-CHANGE:` footer released as a PATCH. This package publishes to
  // npm, so that is the worse direction: consumers upgrade automatically into
  // the break. notesPattern requires the colon, so it cannot match prose.
  // See digitalnsw/nswds-devops#130.
  noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING-CHANGE', 'BREAKING'],
  // notesPattern requires the COLON that the Conventional Commits footer
  // specifies. semantic-release bundles conventional-commits-parser v6, whose
  // default note regex is `^[\\s|*]*(KEYWORDS)[:\\s]+(.*)` — that `[:\\s]+`
  // accepts a SPACE, so an ordinary body line beginning "breaking changes ..."
  // declared a breaking change and took the rest of the sentence as its
  // description. It shipped digitalnsw/engagement v2.0.0 off a Renovate
  // `fix(deps)` bump whose body said the breaking changes did not affect that
  // repo, and digitalnsw/nswds-email v3.0.0 off a refactor.
  //
  // This package publishes to npm, so a false major reaches real consumers.
  //
  // Case-insensitivity and the keyword list are both kept: missing a real
  // breaking change is worse than the prose this costs. The leading `[\\s|*]*`
  // is kept because a squashed PR body arrives bulleted. Commitlint cannot
  // catch this — it resolves parser v7, which already requires the colon.
  // See digitalnsw/nswds-devops#129.
  notesPattern: (keywords) => new RegExp(`^[\\s|*]*(${keywords}):\\s+(.*)`, 'i'),
  breakingHeaderPattern: /^(\w+)(?:\(([^)]*)\))?!: (.*)$/,
}

const releaseConfig = {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        parserOpts,
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'style', release: 'patch' },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        parserOpts,
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
      },
    ],
    // Publishes to npm. Authentication is OIDC trusted publishing — the release
    // workflow requests an id-token and npm mints a short-lived credential, so
    // there is no NPM_TOKEN secret to rotate or leak. This mirrors nswds-tokens.
    '@semantic-release/npm',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    ['@semantic-release/github', { successComment: false, failComment: false }],
  ],
}

export default releaseConfig
