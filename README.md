# markdv

> A fancy markdown viewer for your terminal — browse a directory, hit enter, read beautifully.

`markdv` turns any folder of `.md` files into a navigable reader. No browser, no `cat`, no squinting at raw asterisks. Just a clean two-pane TUI with rendered headings, lists, code, and links, plus a focused reader mode for long-form docs.

## Why

You already live in the terminal. Your README, your notes, your design docs — they're all markdown, and `cat README.md` looks like noise. `markdv` gives you:

- **A real renderer** — bold is bold, headings are styled, code is highlighted, lists are indented. Powered by `marked` + `marked-terminal`.
- **Directory navigation** — point it at a folder and walk the tree with the arrow keys. The preview updates as you select.
- **Reader mode** — hit `enter` on a file to expand it full-width with scroll. `g`/`G` for top/bottom, `space` to page down. Vim-ish without trying too hard.
- **Zero config** — one binary, runs anywhere Node 18+ runs.

## Install

```bash
npm install --global markdv
```

## Usage

```bash
markdv             # browse the current directory
markdv ./docs      # browse a specific path
markdv README.md   # open a single file directly in reader mode
```

## Keys

**Browse mode** — two-pane file tree + preview.

| Key     | Action                               |
| ------- | ------------------------------------ |
| `↑` `↓` | Move selection                       |
| `enter` | Open directory · open file in reader |
| `q`     | Quit                                 |

**Reader mode** — full-width markdown viewer.

| Key                       | Action          |
| ------------------------- | --------------- |
| `↑` `↓`                   | Scroll one line |
| `space` · `pgDn`          | Scroll one page |
| `pgUp`                    | Page up         |
| `g` · `G`                 | Top · bottom    |
| `esc` · `backspace` · `←` | Back to browse  |
| `q`                       | Quit            |

## Built with

[Ink](https://github.com/vadimdemedes/ink) (React for CLIs) · [marked](https://github.com/markedjs/marked) · [marked-terminal](https://github.com/mikaelbr/marked-terminal) · TypeScript

## Development

```bash
npm run dev   # tsc --watch
npm run build # bundle to dist/
npm test      # prettier + ava
```

See [CLAUDE.md](./CLAUDE.md) for architecture notes and toolchain gotchas.

## License

MIT
