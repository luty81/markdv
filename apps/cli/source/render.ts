import fs from 'node:fs';
import {Marked} from 'marked';
// marked-terminal has no bundled types; declare the shape we use.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {markedTerminal} from 'marked-terminal';
import {highlight, supportsLanguage} from 'cli-highlight';
import {isMarkdown, detectLanguage} from '@markdv/core/node';

export const renderMarkdown = (text: string, width: number): string => {
	const instance = new Marked(
		markedTerminal({
			width: Math.max(20, width - 4),
			reflowText: true,
		}) as never,
	);
	return String(instance.parse(text)).replace(/\n$/, '');
};

export const renderHighlighted = (text: string, file: string): string => {
	const language = detectLanguage(file);
	if (!language || !supportsLanguage(language)) return text;
	try {
		return highlight(text, {language, ignoreIllegals: true});
	} catch {
		return text;
	}
};

export const renderFile = (file: string, width: number): string => {
	try {
		const text = fs.readFileSync(file, 'utf8');
		if (isMarkdown(file)) return renderMarkdown(text, width);
		return renderHighlighted(text, file);
	} catch (error) {
		return `Cannot read: ${(error as Error).message}`;
	}
};
