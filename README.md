# markdv

> A fancy file viewer for your terminal — browse a directory, hit enter, read beautifully.

`markdv` turns any folder into a navigable reader. Point it at a tree, walk it with the arrow keys, and open files into a clean reader pane. Markdown is rendered, source code is syntax-highlighted, everything else is shown verbatim.

## Why

You already live in the terminal. Your READMEs, your notes, your design docs, your source — they're all sitting in the same tree, and `cat` looks like noise. `markdv` gives you:

- **Rendered markdown** — bold is bold, headings are styled, lists are indented. Powered by `marked` + `marked-terminal`.
- **Syntax-highlighted source** — TypeScript, Python, Go, Rust, JSON, YAML, and many more, via `cli-highlight` (highlight.js under the hood).
- **Directory navigation** — point it at a folder and walk the tree with the arrow keys. The preview updates as you select.
- **Reader mode** — hit `enter` on a file to expand it full-width with scroll. `g`/`G` for top/bottom, `space` to page down. Vim-ish without trying too hard.
- **Search** — `/` builds a quick index of the current tree and filters by filename or content.
- **Zero config** — one binary, runs anywhere Node 18+ runs.

## Install

```bash
npm install --global @luty81/markdv
```

## Usage

```bash
markdv             # browse the current directory
markdv ./docs      # browse a specific path
markdv README.md   # open a single file directly in reader mode
markdv src/app.ts  # source files work too
```

## Keys

**Browse mode** — two-pane file tree + preview.

| Key     | Action                               |
| ------- | ------------------------------------ |
| `↑` `↓` | Move selection                       |
| `enter` | Open directory · open file in reader |
| `/`     | Search the current tree              |
| `q`     | Quit                                 |

**Reader mode** — full-width viewer.

| Key                       | Action          |
| ------------------------- | --------------- |
| `↑` `↓`                   | Scroll one line |
| `space` · `pgDn`          | Scroll one page |
| `pgUp`                    | Page up         |
| `g` · `G`                 | Top · bottom    |
| `esc` · `backspace` · `←` | Back to browse  |
| `q`                       | Quit            |

**Search mode** — filter by name or content.

| Key     | Action                      |
| ------- | --------------------------- |
| (type)  | Filter results              |
| `↑` `↓` | Select match                |
| `enter` | Open match in reader        |
| `esc`   | Cancel and return to browse |

## Built with

[Ink](https://github.com/vadimdemedes/ink) (React for CLIs) · [marked](https://github.com/markedjs/marked) · [marked-terminal](https://github.com/mikaelbr/marked-terminal) · [cli-highlight](https://github.com/felixfbecker/cli-highlight) · TypeScript

## Development

```bash
npm run dev:cli   # tsup --watch in apps/cli
npm run build     # bundle every workspace
npm test          # prettier + ava
```

See [CLAUDE.md](./CLAUDE.md) for architecture notes and toolchain gotchas.

## License

MIT
