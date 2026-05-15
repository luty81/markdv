import React, {useMemo, useState} from 'react';
import fs from 'node:fs';
import path from 'node:path';
import {Box, Text, useApp, useInput, useStdin, useStdout} from 'ink';
import {
	readEntries,
	buildSearchIndex,
	searchIndex,
	type Entry,
	type IndexedFile,
} from '@markdv/core/node';
import {renderFile} from './render.js';

type Props = {
	path: string;
};

type Mode = 'browse' | 'reader' | 'search';

const PREVIEW_LINES = 40;
const SEARCH_VISIBLE = PREVIEW_LINES;

const resolveInitial = (target: string) => {
	try {
		const stat = fs.statSync(target);
		if (stat.isFile()) {
			const dir = path.dirname(target);
			const name = path.basename(target);
			const idx = readEntries(dir).findIndex((e: Entry) => e.name === name);
			return {
				cwd: dir,
				selected: idx >= 0 ? idx : 0,
				mode: 'reader' as Mode,
				readerFile: target,
			};
		}
	} catch {
		// fall through — let browse mode surface the error
	}
	return {
		cwd: target,
		selected: 0,
		mode: 'browse' as Mode,
		readerFile: null as string | null,
	};
};

type Segment = {text: string; match: boolean};

const splitByMatches = (text: string, needle: string): Segment[] => {
	if (!needle || !text) return [{text, match: false}];
	const lower = text.toLowerCase();
	const lowerNeedle = needle.toLowerCase();
	const out: Segment[] = [];
	let i = 0;
	while (i < text.length) {
		const idx = lower.indexOf(lowerNeedle, i);
		if (idx < 0) {
			out.push({text: text.slice(i), match: false});
			break;
		}
		if (idx > i) out.push({text: text.slice(i, idx), match: false});
		out.push({text: text.slice(idx, idx + needle.length), match: true});
		i = idx + needle.length;
	}
	return out;
};

export default function App({path: initialPath}: Props) {
	const {exit} = useApp();
	const {isRawModeSupported} = useStdin();
	const {stdout} = useStdout();
	const initial = useMemo(() => resolveInitial(initialPath), [initialPath]);
	const [cwd, setCwd] = useState(initial.cwd);
	const [selected, setSelected] = useState(initial.selected);
	const [mode, setMode] = useState<Mode>(initial.mode);
	const [scroll, setScroll] = useState(0);
	const [readerFile, setReaderFile] = useState<string | null>(
		initial.readerFile,
	);
	const [cameFromSearch, setCameFromSearch] = useState(false);
	const [query, setQuery] = useState('');
	const [index, setIndex] = useState<IndexedFile[] | null>(null);
	const [searchSelected, setSearchSelected] = useState(0);

	const entries = useMemo(() => readEntries(cwd), [cwd]);
	const current = entries[selected];
	const cols = stdout?.columns ?? 80;
	const rows = stdout?.rows ?? 24;

	const previewWidth = mode === 'reader' ? cols : Math.max(20, cols - 36);

	const hits = useMemo(() => {
		if (!index) return [];
		return searchIndex(index, query);
	}, [index, query]);

	const clampedSearchSelected =
		hits.length === 0 ? 0 : Math.min(searchSelected, hits.length - 1);
	const selectedHit = hits.length > 0 ? hits[clampedSearchSelected] : undefined;

	const previewFile = useMemo<string | null>(() => {
		if (mode === 'reader') return readerFile;
		if (mode === 'search') {
			return selectedHit && selectedHit.file.scanned
				? selectedHit.file.abs
				: null;
		}
		if (!current || current.isDir) return null;
		return path.join(cwd, current.name);
	}, [mode, readerFile, selectedHit, current, cwd]);

	const rendered = useMemo(() => {
		if (!previewFile) return '';
		return renderFile(previewFile, previewWidth);
	}, [previewFile, previewWidth]);

	const lines = useMemo(() => rendered.split('\n'), [rendered]);

	const viewportRows =
		mode === 'reader' ? Math.max(5, rows - 3) : PREVIEW_LINES;
	const maxScroll = Math.max(0, lines.length - viewportRows);
	const clampedScroll = Math.min(scroll, maxScroll);
	const visible = lines
		.slice(clampedScroll, clampedScroll + viewportRows)
		.join('\n');

	useInput(
		(input, key) => {
			if (mode === 'search') {
				if (key.escape) {
					setMode('browse');
					setQuery('');
					setIndex(null);
					setSearchSelected(0);
					return;
				}
				if (key.return) {
					if (selectedHit) {
						setReaderFile(selectedHit.file.abs);
						setCameFromSearch(true);
						setMode('reader');
						setScroll(0);
					}
					return;
				}
				if (key.upArrow) {
					setSearchSelected(s => Math.max(0, s - 1));
					return;
				}
				if (key.downArrow) {
					setSearchSelected(s => Math.min(Math.max(0, hits.length - 1), s + 1));
					return;
				}
				if (key.backspace || key.delete) {
					setQuery(q => q.slice(0, -1));
					setSearchSelected(0);
					return;
				}
				if (input && !key.ctrl && !key.meta) {
					setQuery(q => q + input);
					setSearchSelected(0);
				}
				return;
			}

			if (input === 'q') {
				exit();
				return;
			}

			if (mode === 'reader') {
				if (key.escape || key.backspace || key.leftArrow) {
					if (cameFromSearch) {
						setMode('search');
						setCameFromSearch(false);
					} else {
						setMode('browse');
					}
					setScroll(0);
					return;
				}
				if (key.upArrow) {
					setScroll(s => Math.max(0, s - 1));
					return;
				}
				if (key.downArrow) {
					setScroll(s => Math.min(maxScroll, s + 1));
					return;
				}
				if (key.pageUp) {
					setScroll(s => Math.max(0, s - viewportRows));
					return;
				}
				if (key.pageDown || input === ' ') {
					setScroll(s => Math.min(maxScroll, s + viewportRows));
					return;
				}
				if (input === 'g') {
					setScroll(0);
					return;
				}
				if (input === 'G') {
					setScroll(maxScroll);
					return;
				}
				return;
			}

			if (input === '/') {
				setIndex(buildSearchIndex(cwd));
				setQuery('');
				setSearchSelected(0);
				setMode('search');
				return;
			}
			if (key.escape) {
				exit();
				return;
			}
			if (key.upArrow) {
				setSelected(s => Math.max(0, s - 1));
				return;
			}
			if (key.downArrow) {
				setSelected(s => Math.min(entries.length - 1, s + 1));
				return;
			}
			if (key.return && current) {
				if (current.isDir) {
					const next = path.resolve(cwd, current.name);
					setCwd(next);
					setSelected(0);
				} else {
					setReaderFile(path.join(cwd, current.name));
					setCameFromSearch(false);
					setMode('reader');
					setScroll(0);
				}
			}
		},
		{isActive: isRawModeSupported},
	);

	if (mode === 'reader' && readerFile) {
		return (
			<Box flexDirection="column">
				<Box>
					<Text bold>{readerFile}</Text>
					<Text dimColor>
						{'  '}
						{clampedScroll + 1}–
						{Math.min(lines.length, clampedScroll + viewportRows)} /{' '}
						{lines.length}
					</Text>
				</Box>
				<Box>
					<Text>{visible}</Text>
				</Box>
				<Box marginTop={1}>
					<Text dimColor>
						↑/↓ scroll · space/pgdn page · g/G top/bottom · esc back · q quit
					</Text>
				</Box>
			</Box>
		);
	}

	if (mode === 'search') {
		const windowStart =
			hits.length <= SEARCH_VISIBLE
				? 0
				: Math.max(
						0,
						Math.min(
							clampedSearchSelected - Math.floor(SEARCH_VISIBLE / 2),
							hits.length - SEARCH_VISIBLE,
						),
				  );
		const visibleHits = hits.slice(windowStart, windowStart + SEARCH_VISIBLE);
		const previewLabel = selectedHit
			? selectedHit.file.scanned
				? selectedHit.file.rel
				: `${selectedHit.file.rel} (skipped — binary or too large)`
			: '';
		return (
			<Box flexDirection="column">
				<Box>
					<Text bold>{cwd}</Text>
				</Box>
				<Box>
					<Text>/ {query}</Text>
					<Text inverse> </Text>
				</Box>
				<Box>
					<Box flexDirection="column" width={32} marginRight={2}>
						{hits.length === 0 && query.length > 0 && (
							<Text dimColor>No matches for "{query}"</Text>
						)}
						{hits.length === 0 && query.length === 0 && index && (
							<Text dimColor>(indexing empty)</Text>
						)}
						{visibleHits.map((hit, i) => {
							const absoluteIndex = windowStart + i;
							const suffix = hit.nameMatch
								? ' name'
								: hit.contentMatch
								? ` :L${hit.firstLine + 1}`
								: '';
							const segments = splitByMatches(hit.file.rel, query);
							return (
								<Text
									key={hit.file.abs}
									inverse={absoluteIndex === clampedSearchSelected}
								>
									{segments.map((seg, si) => (
										<Text
											key={si}
											color={seg.match ? 'yellow' : undefined}
											bold={seg.match}
										>
											{seg.text}
										</Text>
									))}
									<Text dimColor>{suffix}</Text>
								</Text>
							);
						})}
					</Box>
					<Box flexDirection="column" flexGrow={1}>
						<Text dimColor>{previewLabel}</Text>
						<Text>
							{splitByMatches(visible, query).map((seg, si) => (
								<Text
									key={si}
									backgroundColor={seg.match ? 'yellow' : undefined}
									color={seg.match ? 'black' : undefined}
								>
									{seg.text}
								</Text>
							))}
						</Text>
					</Box>
				</Box>
				<Box marginTop={1}>
					<Text dimColor>
						type to filter · ↑/↓ select · enter open · esc cancel
					</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Box>
				<Text bold>{cwd}</Text>
			</Box>
			<Box>
				<Box flexDirection="column" width={32} marginRight={2}>
					{entries.map((entry, index) => (
						<Text
							key={entry.name}
							inverse={index === selected}
							color={entry.isDir ? 'cyan' : undefined}
						>
							{entry.isDir ? '▸ ' : '  '}
							{entry.name}
						</Text>
					))}
				</Box>
				<Box flexDirection="column" flexGrow={1}>
					<Text dimColor>
						{current?.isDir ? '(directory)' : current?.name ?? ''}
					</Text>
					<Text>{visible}</Text>
				</Box>
			</Box>
			<Box marginTop={1}>
				<Text dimColor>
					↑/↓ select · enter {current?.isDir ? 'open dir' : 'read file'} · /
					search · q quit
				</Text>
			</Box>
		</Box>
	);
}
