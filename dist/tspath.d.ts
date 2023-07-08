/**
 * @file TypeScript compiler normalize paths internally by normalizeSlashes.
 * tslab needs to apply the same normalization to support Windows.
 */
export declare function normalizeSlashes(path: string): string;
export declare function normalizeJoin(...paths: string[]): string;
