import React, {useMemo, useState} from 'react';
import fs from 'node:fs';
import path from 'node:path';
import {Box, Text, useApp, useInput, useStdin, useStdout} from 'ink';
import {Marked} from 'marked';
// marked-terminal has no bundled types; declare the shape we use.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {markedTerminal} from 'marked-terminal';
import {readEntries, isMarkdown, type Entry} from '@markdv/core/node';

type Props = {
	path: string;
};

const PREVIEW_LINES = 40;

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
				mode: 'reader' as const,
			};
		}
	} catch {
		// fall through — let browse mode surface the error
	}
	return {cwd: target, selected: 0, mode: 'browse' as const};
};

const renderFile = (file: string, width: number): string => {
	try {
		const text = fs.readFileSync(file, 'utf8');
		if (!isMarkdown(file)) return text;
		const instance = new Marked(
			markedTerminal({
				width: Math.max(20, width - 4),
				reflowText: true,
			}) as never,
		);
		return String(instance.parse(text)).replace(/\n$/, '');
	} catch (error) {
		return `Cannot read: ${(error as Error).message}`;
	}
};

export default function App({path: initialPath}: Props) {
	const {exit} = useApp();
	const {isRawModeSupported} = useStdin();
	const {stdout} = useStdout();
	const initial = useMemo(() => resolveInitial(initialPath), [initialPath]);
	const [cwd, setCwd] = useState(initial.cwd);
	const [selected, setSelected] = useState(initial.selected);
	const [mode, setMode] = useState<'browse' | 'reader'>(initial.mode);
	const [scroll, setScroll] = useState(0);

	const entries = useMemo(() => readEntries(cwd), [cwd]);
	const current = entries[selected];
	const cols = stdout?.columns ?? 80;
	const rows = stdout?.rows ?? 24;

	const previewWidth = mode === 'reader' ? cols : Math.max(20, cols - 36);
	const rendered = useMemo(() => {
		if (!current || current.isDir) return '';
		return renderFile(path.join(cwd, current.name), previewWidth);
	}, [cwd, current, previewWidth]);

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
			if (input === 'q') {
				exit();
				return;
			}

			if (mode === 'reader') {
				if (key.escape || key.backspace || key.leftArrow) {
					setMode('browse');
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
					setMode('reader');
					setScroll(0);
				}
			}
		},
		{isActive: isRawModeSupported},
	);

	if (mode === 'reader' && current) {
		return (
			<Box flexDirection="column">
				<Box>
					<Text bold>{path.join(cwd, current.name)}</Text>
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
					↑/↓ select · enter {current?.isDir ? 'open dir' : 'read file'} · q
					quit
				</Text>
			</Box>
		</Box>
	);
}
