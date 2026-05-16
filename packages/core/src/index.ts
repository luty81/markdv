// Browser-safe surface. Anything that touches `node:fs` lives in `./node`.
export {isMarkdown, isImage, detectLanguage} from './language.js';
export type {Entry} from './types.js';
