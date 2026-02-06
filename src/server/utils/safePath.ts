import path from 'path';

/**
 * Join a user-provided path segment to a base directory, while preventing path traversal.
 *
 * This is used for endpoints that accept filenames/subfolders from the client.
 */
export function safeJoin(baseDir: string, ...unsafeSegments: string[]): string {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(baseDir, ...unsafeSegments);

    const relative = path.relative(resolvedBase, resolvedTarget);

    // If the relative path starts with ".." or is absolute, the target escapes baseDir.
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
        return resolvedTarget;
    }

    throw new Error('Invalid path');
}

