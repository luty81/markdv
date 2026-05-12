#!/usr/bin/env node
import React from 'react';
import path from 'node:path';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
	`
	Usage
	  $ markdv [path]

	Examples
	  $ markdv
	  $ markdv ./docs
`,
	{
		importMeta: import.meta,
	},
);

const start = path.resolve(cli.input[0] ?? process.cwd());

render(<App path={start} />);
