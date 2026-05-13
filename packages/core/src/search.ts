import fs from 'node:fs';
import path from 'node:path';

export type IndexedFile = {
	rel: string;
	abs: string;
	content: string;
	scanned: boolean;
};

export type SearchHit = {
	file: IndexedFile;
	nameMatch: boolean;
	contentMatch: boolean;
	firstLine: number;
};

export type BuildIndexOptions = {
	maxFileBytes?: number;
	maxTotalBytes?: number;
	ignoreDirs?: ReadonlySet<string>;
};

export const DEFAULT_IGNORE_DIRS: ReadonlySet<string> = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'.next',
	'coverage',
]);

const BINARY_SNIFF_BYTES = 4096;

const looksBinary = (buf: Buffer): boolean => {
	const end = Math.min(buf.length, BINARY_SNIFF_BYTES);
	for (let i = 0; i < end; i++) {
		if (buf[i] === 0) return true;
	}
	return false;
};

export const buildSearchIndex = (
	root: string,
	opts: BuildIndexOptions = {},
): IndexedFile[] => {
	const maxFileBytes = opts.maxFileBytes ?? 1_000_000;
	const maxTotalBytes = opts.maxTotalBytes ?? 50_000_000;
	const ignoreDirs = opts.ignoreDirs ?? DEFAULT_IGNORE_DIRS;

	const out: IndexedFile[] = [];
	let totalScanned = 0;

	const walk = (dir: string, relDir: string): void => {
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(dir, {withFileTypes: true});
		} catch {
			return;
		}
		for (const entry of entries) {
			const abs = path.join(dir, entry.name);
			const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				if (ignoreDirs.has(entry.name)) continue;
				walk(abs, rel);
				continue;
			}
			if (!entry.isFile()) continue;

			let size = 0;
			try {
				size = fs.statSync(abs).size;
			} catch {
				continue;
			}

			if (size > maxFileBytes || totalScanned + size > maxTotalBytes) {
				out.push({rel, abs, content: '', scanned: false});
				continue;
			}

			let buf: Buffer;
			try {
				buf = fs.readFileSync(abs);
			} catch {
				out.push({rel, abs, content: '', scanned: false});
				continue;
			}

			if (looksBinary(buf)) {
				out.push({rel, abs, content: '', scanned: false});
				continue;
			}

			totalScanned += size;
			out.push({rel, abs, content: buf.toString('utf8'), scanned: true});
		}
	};

	walk(root, '');
	return out;
};

const basename = (rel: string): string => {
	const slash = rel.lastIndexOf('/');
	return slash < 0 ? rel : rel.slice(slash + 1);
};

const findLineWithMatch = (content: string, needleLower: string): number => {
	if (!content) return -1;
	const lower = content.toLowerCase();
	const idx = lower.indexOf(needleLower);
	if (idx < 0) return -1;
	let line = 0;
	for (let i = 0; i < idx; i++) {
		if (content.charCodeAt(i) === 10) line++;
	}
	return line;
};

export const searchIndex = (
	index: readonly IndexedFile[],
	query: string,
): SearchHit[] => {
	if (query.length === 0) {
		return index.map(file => ({
			file,
			nameMatch: false,
			contentMatch: false,
			firstLine: -1,
		}));
	}

	const needle = query.toLowerCase();
	const hits: SearchHit[] = [];

	for (const file of index) {
		const nameMatch = basename(file.rel).toLowerCase().includes(needle);
		const firstLine = file.scanned
			? findLineWithMatch(file.content, needle)
			: -1;
		const contentMatch = firstLine >= 0;
		if (!nameMatch && !contentMatch) continue;
		hits.push({file, nameMatch, contentMatch, firstLine});
	}

	hits.sort((a, b) => {
		if (a.nameMatch !== b.nameMatch) return a.nameMatch ? -1 : 1;
		return a.file.rel.localeCompare(b.file.rel);
	});

	return hits;
};
