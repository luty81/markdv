import {defineConfig} from 'tsup';

export default defineConfig({
	entry: ['source/cli.tsx'],
	format: ['esm'],
	platform: 'node',
	target: 'node16',
	outDir: 'dist',
	clean: true,
	shims: false,
	dts: false,
	splitting: false,
	sourcemap: false,
	minify: false,
	noExternal: ['@markdv/core'],
});
