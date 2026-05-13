import fs from 'node:fs';
import type {Entry} from './types.js';

export {isMarkdown, MARKDOWN_EXTS} from './markdown.js';
export type {Entry} from './types.js';
export {buildSearchIndex, searchIndex, DEFAULT_IGNORE_DIRS} from './search.js';
export type {IndexedFile, SearchHit, BuildIndexOptions} from './search.js';

export const readEntries = (dir: string): Entry[] => {
	const items = fs
		.readdirSync(dir, {withFileTypes: true})
		.map(d => ({name: d.name, isDir: d.isDirectory()}))
		.sort((a, b) => {
			if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
	return [{name: '..', isDir: true}, ...items];
};
