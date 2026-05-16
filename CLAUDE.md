# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`markdv` is a multi-target file viewer that renders markdown and syntax-highlights source code in the terminal. The repo is an npm-workspaces monorepo with one shared package and one app target today (a desktop target is planned but intentionally not scaffolded yet — don't add an `apps/desktop` directory without checking in first):

```
packages/core   — @markdv/core, UI-agnostic shared logic (types, file-tree, language detection, search)
apps/cli        — markdv, the Ink (React-for-CLI) terminal viewer
```

The CLI is the only target with real functionality. `@markdv/core` keeps a browser-safe entrypoint so future targets (desktop via Tauri, etc.) can share language detection, search, and types without pulling in `node:fs`.

## Commands

All run from the repo root unless noted.

- `npm install` — installs every workspace's deps into a single hoisted `node_modules` and symlinks `@markdv/core` / `@luty81/markdv` into it.
- `npm run build` — builds all workspaces **in dep order** (`@markdv/core` first, then the CLI). CI-safe.
- `npm run build:core` / `build:cli` — build a single target (the cli variant builds `core` first because the app imports from `dist/`).
- `npm run dev:cli` — `tsup --watch` in `apps/cli`. Run `node apps/cli/dist/cli.js [path]` from another terminal to exercise it.
- `npm test` — prettier on the whole repo, then builds core, then runs `ava` in `apps/cli`.
- `npm test -w @luty81/markdv -- -m '<pattern>'` — run a single CLI test by title.

CLI binary path is `apps/cli/dist/cli.js`. There's no global `markdv` link after the workspace migration; either invoke `node apps/cli/dist/cli.js` or run `npm link -w @luty81/markdv` (from root) once to re-link.

## CI/CD

There is **no remote CI** — quality gates run as local git hooks via husky 9 + lint-staged, and releases are kicked off by a manual script. The `prepare` script in root `package.json` re-installs husky after every `npm install`, so a fresh clone is one command away from working hooks.

- **`.husky/pre-commit`** runs `npx lint-staged`, which formats staged files matching the glob in `package.json#lint-staged` with `prettier --write` (and re-stages them). Only touches changed files, so it stays fast.
- **`.husky/pre-push`** runs `npm run build && npm test`. This is the full quality gate — it builds both workspaces (which is also the only typecheck step, since ava runs in transpile-only mode) and runs ava in `apps/cli`. Failures here block the push.
- **`scripts/release.mjs`** (invoked via `npm run release <patch|minor|major>`) refuses to run unless the working tree is clean and you're on `main`. It then: builds, tests, bumps `apps/cli/package.json` via `npm version -w @luty81/markdv --no-git-tag-version`, commits the bump + lockfile, tags `v<version>`, publishes the `@luty81/markdv` workspace to npm with `--access public`, and pushes the tag if an `origin` remote exists. The package is published under the `@luty81` scope because npm blocks the unscoped name `markdv` as too similar to `marked`; the `bin` is still `markdv`, so the CLI is invoked the same way.

The release flow does **not** require an NPM_TOKEN env var — it shells out to `npm publish`, so credentials come from your local npm login (`npm login`). If you ever add a remote CI runner for tag-triggered publish, you'd want to factor the publish step out and feed it `NODE_AUTH_TOKEN` there.

Husky 9 installs delegating shims into `.husky/_/` (managed by husky, gitignored) and points `core.hooksPath` at that directory. The user-edited hook bodies live in `.husky/pre-commit` and `.husky/pre-push` — that's where to make changes.

## Architecture

### `@markdv/core` (`packages/core`)

Two entrypoints, declared in `package.json#exports`:

- `@markdv/core` — browser-safe: `isMarkdown(file)`, `detectLanguage(file)`, and the `Entry` type. **Must not import `node:*` modules** — future browser-side consumers (Vite, Tauri webview) will reject Node built-ins.
- `@markdv/core/node` — adds `readEntries(dir)` and the search index helpers (`buildSearchIndex`, `searchIndex`, `DEFAULT_IGNORE_DIRS`) which use `node:fs`. Used by `apps/cli`. Future Node-only helpers go here, not in the root entry.

Keep this split: the moment something in the root entry imports `node:fs` (or anything via transitive deps), browser bundlers break. Both entries re-export the safe pieces so `apps/cli` can do `import {readEntries, isMarkdown, detectLanguage, type Entry} from '@markdv/core/node'` and get everything in one go.

`language.ts` owns file-type detection. `isMarkdown(file)` decides whether the renderer should treat a file as markdown (rendered via `marked-terminal`); `detectLanguage(file)` returns a [highlight.js](https://highlightjs.org/) language identifier (used by `cli-highlight`) or `null`. Two tables drive `detectLanguage`: `LANGUAGE_BY_FILENAME` is checked first (whole-name match for dotfiles and no-extension files like `.env`, `Dockerfile`, `Makefile`), then `LANGUAGE_BY_EXTENSION` for everything else. `.env.<anything>` is special-cased to `ini`. There's no fallback to auto-detection — anything not in either table is shown verbatim, so extend the appropriate table to teach the renderer about more files.

### `apps/cli` (the CLI)

Two source files:

- `source/cli.tsx` — entry point. Parses argv with `meow`, resolves `cli.input[0] ?? process.cwd()` to an absolute path, then `render(<App path={start} />)`. The shebang + `bin` field is what makes `markdv` an executable after `npm run build`.
- `source/app.tsx` — the entire TUI. Three display modes selected by the `mode` state:
  - **browse** — two-pane layout (file tree + preview). `↑/↓` moves selection, `enter` on a dir descends, `enter` on a file switches to reader mode, `/` opens search. Preview pane shows the first 40 lines of the selected file.
  - **reader** — full-width file viewer with line scroll (`↑/↓`), page scroll (`space`/`pgUp`/`pgDn`), `g`/`G` top/bottom, `esc`/`backspace`/`←` back to browse.
  - **search** — content + filename search across the current tree. Type to filter, `↑/↓` to select, `enter` to open in reader, `esc` to cancel.
  - `q` quits from browse or reader (not from search — `esc` cancels first).
- `resolveInitial(target)` stat's the path: if it's a file, starts in `reader` mode with `cwd = dirname(target)` so pressing `esc` returns to a browse view with that file selected.

The split between `cli.tsx` (argv → resolved path) and `app.tsx` (everything else) is deliberate: `app.tsx` is what `test.tsx` imports, so it must take its starting path as a prop and not touch `process.argv` itself.

`renderFile()` dispatches by file type:

- **markdown** (per `isMarkdown()`) → rendered with a fresh `new Marked(markedTerminal({width, reflowText: true}))`. `marked-terminal` ships no types — the import has a `@ts-ignore` and the options are cast to `never` to satisfy `Marked`'s constructor signature. Don't replace the lib without updating both.
- **known language** (per `detectLanguage()`) → passed through `cli-highlight`'s `highlight(text, {language, ignoreIllegals: true})`. Wrapped in `try/catch` so a highlight failure falls back to plain text rather than crashing the render path. `supportsLanguage(language)` is also checked before calling — highlight.js silently returns no-op for unknown languages, but the explicit check keeps the fallback path obvious.
- **anything else** → returned verbatim.

The whole pipeline is wrapped in `useMemo` keyed on `(previewFile, previewWidth)` so it only re-runs when those change. `previewWidth` and `viewportRows` are computed from `useStdout()`'s `columns`/`rows`; in reader mode the viewport takes the full terminal height (minus 3 for header/footer), in browse mode it's a fixed 40 lines so the layout stays stable while scrolling the tree.

## Toolchain gotchas

These are not obvious from the scaffold and will bite anyone who touches the test/lint setup:

- **`xo` is removed entirely.** The `eslint-plugin-unicorn` version pinned by `xo@0.53` (what `create-ink-app` ships) crashes with `Cannot read properties of undefined (reading 'getAllComments')` on the `unicorn/expiring-todo-comments` rule when run under modern ESLint. Don't add `xo` back without first upgrading to a version with a compatible unicorn plugin.
- **CLI tests run with `TS_NODE_TRANSPILE_ONLY=true`** (set via `ava.environmentVariables` in `apps/cli/package.json`). Without it, `ts-node/esm` tries to typecheck `test.tsx` and fails with `Type 'typeof import(".../ava/entrypoints/main")' has no call signatures.` Even adding `esModuleInterop: true` doesn't fix the ts-node typecheck path. Type-checking still happens via `tsc` during the build — just not from inside ava's loader.
- **`apps/cli/tsconfig.json` enables `esModuleInterop: true`** on top of `@sindresorhus/tsconfig`. Required for `import test from 'ava'` and `import chalk from 'chalk'` to typecheck.
- **`ink-testing-library`'s mock stdin doesn't implement `.ref()`/`.unref()`**, which ink@4's `useInput` calls during the React effect phase, throwing `stdin.ref is not a function`. `apps/cli/test.tsx` monkey-patches `EventEmitter.prototype` with no-op `ref`/`unref` at module load so the mock satisfies ink's interface. Removing it will break tests that mount a component using `useInput`.
- **`.claude` is in `.prettierignore`** because `settings.local.json` uses tab indentation incompatible with the project's prettier config. Don't reformat it.
- **Root `npm run build` order is hard-coded** (`core` → `cli`) rather than relying on `--workspaces` because npm doesn't guarantee topological order across workspaces. If you add a new dependent of `@markdv/core`, add it to the chain.
- **Top-level prettier owns the whole repo.** Per-workspace prettier configs would just split-brain — keep `@vdemedes/prettier-config` and `prettier` in root devDeps only.

## Conventions

- **Tabs, LF, final newline** — enforced by `.editorconfig` and prettier (`@vdemedes/prettier-config`).
- **ESM only** (`"type": "module"` everywhere). In `apps/cli` and `packages/core`, imports of local files use the `.js` extension even from `.ts`/`.tsx` sources (e.g. `import App from './app.js'`) because of `module: node16`. Do **not** write `.ts`/`.tsx` in import specifiers in those packages.
- **No JSX runtime auto-import in CLI**: `apps/cli/tsconfig.json` uses `"jsx": "react"`, so `import React from 'react'` is required in every `.tsx` file.
- **`noUncheckedIndexedAccess` is on** in CLI/core (inherited from `@sindresorhus/tsconfig`). Any indexed access is typed as `T | undefined` — handle accordingly.
- **Cross-package imports use the package name**, not relative paths (`import {x} from '@markdv/core'`, not `../../packages/core/src/x.js`). This is what makes the workspace symlinks meaningful and lets each package have its own build/typecheck boundary.
