import fs from 'node:fs';
import {Marked} from 'marked';
// marked-terminal has no bundled types; declare the shape we use.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {markedTerminal} from 'marked-terminal';
import {highlight, supportsLanguage} from 'cli-highlight';
import {isMarkdown, isImage, detectLanguage} from '@markdv/core/node';

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
		if (isImage(file)) return '';
		const text = fs.readFileSync(file, 'utf8');
		if (isMarkdown(file)) return renderMarkdown(text, width);
		return renderHighlighted(text, file);
	} catch (error) {
		return `Cannot read: ${(error as Error).message}`;
	}
};

// Rendered terminal images can be wide; cap the column count so very large
// images don't blow past the available viewport.
const MAX_IMAGE_COLS = 200;

// Dynamic import keeps jimp (terminal-image's heavy dep) out of the test
// loader path — tests that import ./render.js only pay for it when an image
// is actually rendered.
export const renderImage = async (
	file: string,
	width: number,
): Promise<string> => {
	try {
		const buffer = await fs.promises.readFile(file);
		const {default: terminalImage} = await import('terminal-image');
		const cols = Math.max(20, Math.min(width, MAX_IMAGE_COLS));
		const out = await terminalImage.buffer(buffer, {width: cols});
		return out.replace(/\n$/, '');
	} catch (error) {
		return `Cannot render image: ${(error as Error).message}`;
	}
};
