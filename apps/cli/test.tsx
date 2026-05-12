import React from 'react';
import {EventEmitter} from 'node:events';
import test from 'ava';
import {render} from 'ink-testing-library';
import App from './source/app.js';

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
