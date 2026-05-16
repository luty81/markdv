const getBasename = (file: string): string => {
	const slash = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));
	return slash >= 0 ? file.slice(slash + 1) : file;
};

const getExtension = (file: string): string | null => {
	const name = getBasename(file);
	const dot = name.lastIndexOf('.');
	if (dot <= 0) return null;
	return name.slice(dot).toLowerCase();
};

const MARKDOWN_EXTENSIONS: ReadonlySet<string> = new Set([
	'.md',
	'.markdown',
	'.mdown',
	'.mkd',
]);

export const isMarkdown = (file: string): boolean => {
	const ext = getExtension(file);
	return ext !== null && MARKDOWN_EXTENSIONS.has(ext);
};

// Raster image formats rendered via terminal-image. SVG is intentionally
// excluded — it's text and falls through to xml highlighting.
const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.webp',
	'.bmp',
	'.tif',
	'.tiff',
]);

export const isImage = (file: string): boolean => {
	const ext = getExtension(file);
	return ext !== null && IMAGE_EXTENSIONS.has(ext);
};

// Maps whole filenames (dotfiles or no-extension files) to highlight.js
// language identifiers. Matched before LANGUAGE_BY_EXTENSION so files like
// `.env` or `Dockerfile` — which have no real extension — can still be
// highlighted.
const LANGUAGE_BY_FILENAME: Readonly<Record<string, string>> = {
	'.env': 'ini',
	Dockerfile: 'dockerfile',
	GNUmakefile: 'makefile',
	Makefile: 'makefile',
};

// Maps file extensions to highlight.js language identifiers (used by
// cli-highlight). Extend this table to teach the renderer about new
// languages. Anything not listed falls back to plain text in the CLI.
const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
	'.bash': 'bash',
	'.c': 'c',
	'.cc': 'cpp',
	'.cjs': 'javascript',
	'.clj': 'clojure',
	'.cpp': 'cpp',
	'.cs': 'csharp',
	'.css': 'css',
	'.cxx': 'cpp',
	'.dart': 'dart',
	'.diff': 'diff',
	'.dockerfile': 'dockerfile',
	'.elm': 'elm',
	'.erl': 'erlang',
	'.ex': 'elixir',
	'.exs': 'elixir',
	'.fish': 'bash',
	'.go': 'go',
	'.gql': 'graphql',
	'.graphql': 'graphql',
	'.groovy': 'groovy',
	'.h': 'c',
	'.hbs': 'handlebars',
	'.hpp': 'cpp',
	'.hs': 'haskell',
	'.htm': 'xml',
	'.html': 'xml',
	'.ini': 'ini',
	'.java': 'java',
	'.js': 'javascript',
	'.json': 'json',
	'.jsx': 'javascript',
	'.kt': 'kotlin',
	'.less': 'less',
	'.lua': 'lua',
	'.makefile': 'makefile',
	'.mjs': 'javascript',
	'.patch': 'diff',
	'.php': 'php',
	'.pl': 'perl',
	'.proto': 'protobuf',
	'.py': 'python',
	'.r': 'r',
	'.rb': 'ruby',
	'.rs': 'rust',
	'.sass': 'scss',
	'.scala': 'scala',
	'.scss': 'scss',
	'.sh': 'bash',
	'.sql': 'sql',
	'.swift': 'swift',
	'.tf': 'hcl',
	'.toml': 'ini',
	'.ts': 'typescript',
	'.tsx': 'typescript',
	'.vim': 'vim',
	'.vue': 'xml',
	'.xml': 'xml',
	'.yaml': 'yaml',
	'.yml': 'yaml',
	'.zsh': 'bash',
};

export const detectLanguage = (file: string): string | null => {
	const name = getBasename(file);
	const byName = LANGUAGE_BY_FILENAME[name];
	if (byName) return byName;
	// `.env.local`, `.env.production`, etc. — all key=value config.
	if (name.startsWith('.env.')) return 'ini';
	const ext = getExtension(file);
	if (ext === null) return null;
	return LANGUAGE_BY_EXTENSION[ext] ?? null;
};
