import fs from 'node:fs';
import path from 'node:path';

const ANSI_RE = /\x1B\[[0-9;]*[A-Za-z]/g;

const ANSI_16: readonly string[] = [
	'#000000',
	'#cd0000',
	'#00cd00',
	'#cdcd00',
	'#0000ee',
	'#cd00cd',
	'#00cdcd',
	'#e5e5e5',
	'#7f7f7f',
	'#ff0000',
	'#00ff00',
	'#ffff00',
	'#5c5cff',
	'#ff00ff',
	'#00ffff',
	'#ffffff',
];

const DEFAULT_FG = '#e5e5e5';
const DEFAULT_BG = '#1e1e1e';

type Style = {
	fg?: string;
	bg?: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	inverse?: boolean;
};

type Span = {text: string; style: Style};

let lastFrame = '';

// Monkey-patch the stream's write so we can recover the most recent
// rendered frame on demand. ink writes the entire frame on every render,
// so the last write is the current screen content.
export const captureFrames = (
	stream: NodeJS.WriteStream | undefined,
): (() => void) => {
	if (!stream) return () => {};
	const target = stream as unknown as {
		write: (chunk: unknown, ...rest: unknown[]) => boolean;
	};
	const original = target.write.bind(stream);
	const wrapped = (chunk: unknown, ...rest: unknown[]): boolean => {
		if (typeof chunk === 'string') lastFrame = chunk;
		else if (Buffer.isBuffer(chunk)) lastFrame = chunk.toString('utf8');
		return original(chunk, ...rest);
	};
	target.write = wrapped;
	return () => {
		target.write = original;
	};
};

// Keep SGR (color/style, ends in `m`); drop cursor moves & screen clears.
const cleanFrame = (raw: string): string =>
	raw.replace(ANSI_RE, match => (match.endsWith('m') ? match : ''));

const applySGR = (params: number[], current: Style): Style => {
	const next: Style = {...current};
	let i = 0;
	while (i < params.length) {
		const p = params[i] ?? 0;
		if (p === 0) {
			next.fg = undefined;
			next.bg = undefined;
			next.bold = false;
			next.italic = false;
			next.underline = false;
			next.inverse = false;
		} else if (p === 1) next.bold = true;
		else if (p === 22) next.bold = false;
		else if (p === 3) next.italic = true;
		else if (p === 23) next.italic = false;
		else if (p === 4) next.underline = true;
		else if (p === 24) next.underline = false;
		else if (p === 7) next.inverse = true;
		else if (p === 27) next.inverse = false;
		else if (p >= 30 && p <= 37) next.fg = ANSI_16[p - 30];
		else if (p === 39) next.fg = undefined;
		else if (p >= 40 && p <= 47) next.bg = ANSI_16[p - 40];
		else if (p === 49) next.bg = undefined;
		else if (p >= 90 && p <= 97) next.fg = ANSI_16[p - 90 + 8];
		else if (p >= 100 && p <= 107) next.bg = ANSI_16[p - 100 + 8];
		else if (p === 38 || p === 48) {
			const mode = params[i + 1];
			if (mode === 2 && i + 4 < params.length) {
				const r = params[i + 2] ?? 0;
				const g = params[i + 3] ?? 0;
				const b = params[i + 4] ?? 0;
				const hex = `#${[r, g, b]
					.map(v => v.toString(16).padStart(2, '0'))
					.join('')}`;
				if (p === 38) next.fg = hex;
				else next.bg = hex;
				i += 4;
			} else if (mode === 5 && i + 2 < params.length) {
				const idx = params[i + 2] ?? 0;
				const color = idx < 16 ? ANSI_16[idx] ?? DEFAULT_FG : '#888888';
				if (p === 38) next.fg = color;
				else next.bg = color;
				i += 2;
			}
		}
		i += 1;
	}
	return next;
};

const parseAnsi = (input: string): Span[][] => {
	const lines: Span[][] = [[]];
	let style: Style = {};
	let i = 0;
	while (i < input.length) {
		const ch = input[i];
		if (ch === '\x1B' && input[i + 1] === '[') {
			const end = input.indexOf('m', i + 2);
			if (end < 0) {
				i += 1;
				continue;
			}
			const params = input
				.slice(i + 2, end)
				.split(';')
				.map(s => Number.parseInt(s, 10) || 0);
			style = applySGR(params, style);
			i = end + 1;
			continue;
		}
		if (ch === '\n') {
			lines.push([]);
			i += 1;
			continue;
		}
		let j = i;
		while (j < input.length && input[j] !== '\x1B' && input[j] !== '\n') j += 1;
		const line = lines[lines.length - 1]!;
		line.push({text: input.slice(i, j), style: {...style}});
		i = j;
	}
	return lines;
};

const escapeXml = (s: string): string =>
	s
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');

export const ansiToSvg = (ansi: string): string => {
	const lines = parseAnsi(ansi);
	const charWidth = 8.4;
	const lineHeight = 17;
	const fontSize = 14;
	const padding = 12;
	const cols = Math.max(
		1,
		...lines.map(line => line.reduce((sum, span) => sum + span.text.length, 0)),
	);
	const width = Math.ceil(cols * charWidth + padding * 2);
	const height = Math.ceil(lines.length * lineHeight + padding * 2);
	const parts: string[] = [];
	parts.push(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="${fontSize}">`,
		`<rect width="100%" height="100%" fill="${DEFAULT_BG}"/>`,
	);
	for (let row = 0; row < lines.length; row += 1) {
		const line = lines[row]!;
		const baseY = padding + (row + 1) * lineHeight - 4;
		const rectY = padding + row * lineHeight;
		let col = 0;
		for (const span of line) {
			if (!span.text) continue;
			const fg = span.style.inverse
				? span.style.bg ?? DEFAULT_BG
				: span.style.fg ?? DEFAULT_FG;
			const bg = span.style.inverse
				? span.style.fg ?? DEFAULT_FG
				: span.style.bg;
			const x = padding + col * charWidth;
			if (bg) {
				const w = span.text.length * charWidth;
				parts.push(
					`<rect x="${x.toFixed(2)}" y="${rectY}" width="${w.toFixed(
						2,
					)}" height="${lineHeight}" fill="${bg}"/>`,
				);
			}
			const attrs = [
				`x="${x.toFixed(2)}"`,
				`y="${baseY}"`,
				`fill="${fg}"`,
				'xml:space="preserve"',
			];
			if (span.style.bold) attrs.push('font-weight="bold"');
			if (span.style.italic) attrs.push('font-style="italic"');
			if (span.style.underline) attrs.push('text-decoration="underline"');
			parts.push(`<text ${attrs.join(' ')}>${escapeXml(span.text)}</text>`);
			col += span.text.length;
		}
	}
	parts.push('</svg>');
	return parts.join('\n');
};

const timestamp = (): string => {
	const d = new Date();
	const pad = (n: number, w = 2) => String(n).padStart(w, '0');
	return (
		`${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
		`-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
		`-${pad(d.getMilliseconds(), 3)}`
	);
};

export type ScreenshotFormat = 'svg' | 'txt';

export const writeScreenshot = (
	dir: string,
	format: ScreenshotFormat,
): string | null => {
	const frame = cleanFrame(lastFrame);
	if (!frame.trim()) return null;
	const base = `markdv-screenshot-${timestamp()}`;
	const file = path.join(dir, `${base}.${format}`);
	const contents = format === 'svg' ? ansiToSvg(frame) : frame;
	fs.writeFileSync(file, contents);
	return file;
};
