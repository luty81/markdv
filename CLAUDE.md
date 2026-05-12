# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`markdv` is a multi-target markdown viewer. The repo is an npm-workspaces monorepo with one shared package and two app targets today (desktop is planned but intentionally not scaffolded yet — don't add an `apps/desktop` directory without checking in first):

```
packages/core   — @markdv/core, UI-agnostic shared logic (types, file-tree, ext detection)
apps/cli        — markdv, the Ink (React-for-CLI) terminal viewer (the original app)
apps/web        — @markdv/web, Vite + React stub for the browser target (not yet implemented)
```

The CLI is the only target with real functionality. The web app is a placeholder that imports from `@markdv/core` to prove workspace wiring works; it doesn't yet render or browse anything.

## Commands

All run from the repo root unless noted.

- `npm install` — installs every workspace's deps into a single hoisted `node_modules` and symlinks `@markdv/core` / `markdv` / `@markdv/web` into it.
- `npm run build` — builds all workspaces **in dep order** (`@markdv/core` first, then the apps). CI-safe.
- `npm run build:core` / `build:cli` / `build:web` — build a single target (the cli and web variants build `core` first because the apps import from `dist/`).
- `npm run dev:cli` — `tsc --watch` in `apps/cli`. Run `node apps/cli/dist/cli.js [path]` from another terminal to exercise it.
- `npm run dev:web` — `vite` dev server for `apps/web` (default port 5173).
- `npm test` — prettier on the whole repo, then builds core, then runs `ava` in `apps/cli`. Web has no tests yet.
- `npm test -w markdv -- -m '<pattern>'` — run a single CLI test by title.

CLI binary path is `apps/cli/dist/cli.js`. There's no global `markdv` link after the workspace migration; either invoke `node apps/cli/dist/cli.js` or run `npm link -w markdv` (from root) once to re-link.

## Architecture

### `@markdv/core` (`packages/core`)

Two entrypoints, declared in `package.json#exports`:

- `@markdv/core` — browser-safe: `MARKDOWN_EXTS`, `isMarkdown(file)`, and the `Entry` type. **Must not import `node:*` modules** — `apps/web` consumes this directly via Vite, which will reject Node built-ins.
- `@markdv/core/node` — adds `readEntries(dir)` which uses `node:fs`. Used by `apps/cli`. Future Node-only helpers go here, not in the root entry.

Keep this split: the moment something in the root entry imports `node:fs` (or anything via transitive deps), Vite breaks. Both entries re-export the safe pieces so `apps/cli` can do `import {readEntries, isMarkdown, type Entry} from '@markdv/core/node'` and get everything in one go.

### `apps/cli` (the CLI)

Two source files:

- `source/cli.tsx` — entry point. Parses argv with `meow`, resolves `cli.input[0] ?? process.cwd()` to an absolute path, then `render(<App path={start} />)`. The shebang + `bin` field is what makes `markdv` an executable after `npm run build`.
- `source/app.tsx` — the entire TUI. Two display modes selected by the `mode` state:
  - **browse** — two-pane layout (file tree + preview). `↑/↓` moves selection, `enter` on a dir descends, `enter` on a file switches to reader mode. Preview pane shows the first 40 lines of the selected file (markdown-rendered if `isMarkdown()` returns true).
  - **reader** — full-width markdown viewer with line scroll (`↑/↓`), page scroll (`space`/`pgUp`/`pgDn`), `g`/`G` top/bottom, `esc`/`backspace`/`←` back to browse.
  - `q` quits from either mode.
- `resolveInitial(target)` stat's the path: if it's a file, starts in `reader` mode with `cwd = dirname(target)` so pressing `esc` returns to a browse view with that file selected.

The split between `cli.tsx` (argv → resolved path) and `app.tsx` (everything else) is deliberate: `app.tsx` is what `test.tsx` imports, so it must take its starting path as a prop and not touch `process.argv` itself.

Markdown rendering uses `marked` + `marked-terminal`. A fresh `new Marked(markedTerminal({width, reflowText: true}))` is constructed per render call inside `renderFile()`; this is wrapped in `useMemo` keyed on `(cwd, current, previewWidth)` so it only re-runs when those change. `marked-terminal` ships no types — the import has a `@ts-ignore` and the options are cast to `never` to satisfy `Marked`'s constructor signature. Don't replace the lib without updating both.

`previewWidth` and `viewportRows` are computed from `useStdout()`'s `columns`/`rows`. In reader mode the viewport takes the full terminal height (minus 3 for header/footer); in browse mode it's a fixed 40 lines so the layout stays stable while scrolling the tree.

### `apps/web` (stub)

Vite + React + TS scaffold, hand-written (no `create-vite`). `src/App.tsx` imports `isMarkdown` from `@markdv/core` purely to prove the workspace symlink resolves through Vite's bundler resolution. Replace the stub when actually building the web viewer; the `tsconfig.json` uses `moduleResolution: "bundler"` so `.js` extensions on relative imports are optional here (unlike the CLI).

## Toolchain gotchas

These are not obvious from the scaffold and will bite anyone who touches the test/lint setup:

- **`xo` is removed entirely.** The `eslint-plugin-unicorn` version pinned by `xo@0.53` (what `create-ink-app` ships) crashes with `Cannot read properties of undefined (reading 'getAllComments')` on the `unicorn/expiring-todo-comments` rule when run under modern ESLint. Don't add `xo` back without first upgrading to a version with a compatible unicorn plugin.
- **CLI tests run with `TS_NODE_TRANSPILE_ONLY=true`** (set via `ava.environmentVariables` in `apps/cli/package.json`). Without it, `ts-node/esm` tries to typecheck `test.tsx` and fails with `Type 'typeof import(".../ava/entrypoints/main")' has no call signatures.` Even adding `esModuleInterop: true` doesn't fix the ts-node typecheck path. Type-checking still happens via `tsc` during the build — just not from inside ava's loader.
- **`apps/cli/tsconfig.json` enables `esModuleInterop: true`** on top of `@sindresorhus/tsconfig`. Required for `import test from 'ava'` and `import chalk from 'chalk'` to typecheck.
- **`ink-testing-library`'s mock stdin doesn't implement `.ref()`/`.unref()`**, which ink@4's `useInput` calls during the React effect phase, throwing `stdin.ref is not a function`. `apps/cli/test.tsx` monkey-patches `EventEmitter.prototype` with no-op `ref`/`unref` at module load so the mock satisfies ink's interface. Removing it will break tests that mount a component using `useInput`.
- **`.claude` is in `.prettierignore`** because `settings.local.json` uses tab indentation incompatible with the project's prettier config. Don't reformat it.
- **Root `npm run build` order is hard-coded** (`core` → `cli` → `web`) rather than relying on `--workspaces` because npm doesn't guarantee topological order across workspaces. If you add a new dependent of `@markdv/core`, add it to the chain.
- **Top-level prettier owns the whole repo.** Per-workspace prettier configs would just split-brain — keep `@vdemedes/prettier-config` and `prettier` in root devDeps only.

## Conventions

- **Tabs, LF, final newline** — enforced by `.editorconfig` and prettier (`@vdemedes/prettier-config`).
- **ESM only** (`"type": "module"` everywhere). In `apps/cli` and `packages/core`, imports of local files use the `.js` extension even from `.ts`/`.tsx` sources (e.g. `import App from './app.js'`) because of `module: node16`. Do **not** write `.ts`/`.tsx` in import specifiers in those packages. `apps/web` is the exception — it uses `moduleResolution: "bundler"`, so extensions are optional there.
- **No JSX runtime auto-import in CLI**: `apps/cli/tsconfig.json` uses `"jsx": "react"`, so `import React from 'react'` is required in every `.tsx` file. `apps/web` uses `"jsx": "react-jsx"` and does not.
- **`noUncheckedIndexedAccess` is on** in CLI/core (inherited from `@sindresorhus/tsconfig`). Any indexed access is typed as `T | undefined` — handle accordingly.
- **Cross-package imports use the package name**, not relative paths (`import {x} from '@markdv/core'`, not `../../packages/core/src/x.js`). This is what makes the workspace symlinks meaningful and lets each package have its own build/typecheck boundary.
