export const MARKDOWN_EXTS = new Set(['.md', '.markdown', '.mdown', '.mkd']);

export const isMarkdown = (file: string): boolean => {
	const dot = file.lastIndexOf('.');
	if (dot < 0) return false;
	return MARKDOWN_EXTS.has(file.slice(dot).toLowerCase());
};
