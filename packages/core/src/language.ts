const getExtension = (file: string): string | null => {
	const slash = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));
	const name = slash >= 0 ? file.slice(slash + 1) : file;
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
	const ext = getExtension(file);
	if (ext === null) return null;
	return LANGUAGE_BY_EXTENSION[ext] ?? null;
};
