/** Normalized (POSIX) path separator used in file paths and node IDs. */
export const PATH_SEPARATOR = '/';

/** Separates the file path from the symbol name in a node ID. */
export const NODE_ID_SEPARATOR = '::';

/** Matches a trailing JS/TS module extension so specifiers can be compared without it. */
export const MODULE_EXTENSION_PATTERN = /\.(js|mjs|ts)$/;

/** Matches Windows path separators, which are normalized to {@link PATH_SEPARATOR}. */
export const WINDOWS_PATH_SEPARATOR_PATTERN = /\\/g;

/** Matches leading `./` and `../` segments of a relative path. */
export const LEADING_RELATIVE_SEGMENT_PATTERN = /^(\.\/|\.\.\/)+/;

/** Prefix of import specifiers that point inside the parsed project. */
export const RELATIVE_PATH_PREFIX = '.';
