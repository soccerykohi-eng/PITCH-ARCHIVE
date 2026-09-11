# PITCH ARCHIVE Work Baseline

This archive preserves the source state used by the published PITCH ARCHIVE Site.

- Sites project: `appgprj_6a8fdaea06188191a2c29504b4acb43c`
- Published version: `77`
- Source commit: `e4d1e7f2feb6672977247c82a892f421837b1f98`
- Production content snapshot: `backup/production-content.json`

## Contents

The original application source is preserved without refactoring. It includes the
React/TypeScript app, styles, API routes, game logic, card and mission definitions,
database schema and migrations, persistence code, public assets, worker entrypoint,
package manifests, lockfiles, tests, and Sites hosting configuration.

The production content snapshot contains the non-user content tables needed to
reconstruct the current catalog: cards, packs, pack-to-card assignments, and
announcements. User accounts, collections, social data, notifications, push
subscriptions, audit logs, and play history are intentionally excluded to avoid
copying personal information and device endpoints.

## Local setup

1. Install Node.js 22.13 or newer.
2. Run `npm ci`.
3. Run `npm run dev` for local development.
4. Run `npm test` and `npm run build` before deployment.

The hosted version uses Sites-managed Cloudflare bindings declared in
`.openai/hosting.json`, including D1 storage. No secret values or temporary
repository credentials are included in this archive.

