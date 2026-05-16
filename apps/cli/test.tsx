import React from 'react';
import {EventEmitter} from 'node:events';
import test from 'ava';
import {render} from 'ink-testing-library';
import {isImage} from '@markdv/core/node';
import App from './source/app.js';
import {renderHighlighted} from './source/render.js';
import {ansiToSvg} from './source/screenshot.js';

const ANSI_CSI = /\x1b\[[0-9;]*m/;

// ink@4's useInput calls stdin.ref()/.unref(). ink-testing-library's mock
// Stdin extends EventEmitter and doesn't implement them, which crashes
// rendering during the effect phase. Patch the prototype with no-ops so
// the mock satisfies ink's interface.
const proto = EventEmitter.prototype as unknown as {
	ref?: () => void;
	unref?: () => void;
};
if (typeof proto.ref !== 'function') proto.ref = () => {};
if (typeof proto.unref !== 'function') proto.unref = () => {};

test('renders directory header', t => {
	const {lastFrame} = render(<App path={process.cwd()} />);
	t.true(lastFrame()?.includes(process.cwd()) ?? false);
});

test('lists parent navigation entry', t => {
	const {lastFrame} = render(<App path={process.cwd()} />);
	t.true(lastFrame()?.includes('..') ?? false);
});

const tick = () => new Promise(resolve => setTimeout(resolve, 50));

// ink@4 reads stdin via the 'readable' event + stdin.read(), but
// ink-testing-library@3 only emits 'data'. Feed input through a small
// shim that satisfies ink's stream protocol.
const sendInput = (stdin: NodeJS.WritableStream, data: string) => {
	const s = stdin as unknown as {
		_buf?: string | null;
		read?: () => string | null;
		emit: (event: string) => void;
	};
	s._buf = (s._buf ?? '') + data;
	if (!s.read) {
		s.read = function () {
			const out = this._buf ?? null;
			this._buf = null;
			return out;
		};
	}
	s.emit('readable');
};

test('pressing / opens the search prompt', async t => {
	const {stdin, lastFrame} = render(<App path={process.cwd()} />);
	await tick();
	sendInput(stdin, '/');
	await tick();
	const frame = lastFrame() ?? '';
	t.true(frame.includes('type to filter'));
	t.true(frame.includes('esc cancel'));
});

test('typing filters the search results', async t => {
	const {stdin, lastFrame} = render(<App path={process.cwd()} />);
	await tick();
	sendInput(stdin, '/');
	await tick();
	sendInput(stdin, 'app');
	await tick();
	const frame = lastFrame() ?? '';
	t.true(frame.includes('/ app'));
	t.true(frame.includes('app.tsx'));
});

test('renderHighlighted colorizes known source languages', t => {
	const source = "const greeting: string = 'hi';";
	const out = renderHighlighted(source, 'sample.ts');
	t.regex(out, ANSI_CSI);
	t.true(out.includes('const'));
	t.true(out.includes("'hi'"));
});

test('renderHighlighted returns plain text for unknown extensions', t => {
	const source = 'this is just plain text\nwith a second line';
	t.is(renderHighlighted(source, 'notes.unknownext'), source);
});

test('renderHighlighted colorizes .env files as ini', t => {
	const source = '# comment\nAPI_KEY=abc123\nPORT=3000';
	const out = renderHighlighted(source, '.env');
	t.regex(out, ANSI_CSI);
	t.true(out.includes('API_KEY'));
});

test('renderHighlighted colorizes .env.local as ini', t => {
	const source = 'DATABASE_URL=postgres://localhost/dev';
	const out = renderHighlighted(source, '/some/path/.env.local');
	t.regex(out, ANSI_CSI);
});

test('renderHighlighted colorizes Dockerfile with no extension', t => {
	const source = 'FROM node:20\nRUN npm install';
	const out = renderHighlighted(source, 'Dockerfile');
	t.regex(out, ANSI_CSI);
	t.true(out.includes('FROM'));
});

test('isImage flags raster image extensions', t => {
	t.true(isImage('photo.png'));
	t.true(isImage('photo.PNG'));
	t.true(isImage('/abs/path/to/cat.jpeg'));
	t.true(isImage('chart.gif'));
	t.true(isImage('shot.webp'));
});

test('isImage rejects non-images and SVG', t => {
	t.false(isImage('notes.md'));
	t.false(isImage('script.ts'));
	t.false(isImage('drawing.svg'));
	t.false(isImage('README'));
});

test('ansiToSvg emits a well-formed SVG preserving colored spans', t => {
	const input = '\x1b[31mhello\x1b[0m world';
	const svg = ansiToSvg(input);
	t.true(svg.startsWith('<svg '));
	t.true(svg.endsWith('</svg>'));
	t.true(svg.includes('hello'));
	t.true(svg.includes('world'));
	// red foreground in the 16-color table
	t.true(svg.includes('#cd0000'));
});

test('ansiToSvg escapes XML-special characters in the output text', t => {
	const svg = ansiToSvg('<tag attr="v">&copy;');
	t.true(svg.includes('&lt;tag attr=&quot;v&quot;&gt;&amp;copy;'));
	t.false(svg.includes('<tag attr="v">'));
});
