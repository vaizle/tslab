"use strict";
/**
 * @file TypeScript compiler normalize paths internally by normalizeSlashes.
 * tslab needs to apply the same normalization to support Windows.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeJoin = exports.normalizeSlashes = void 0;
const path_1 = require("path");
const backslashRegExp = /\\/g;
function normalizeSlashes(path) {
    return path.replace(backslashRegExp, "/");
}
exports.normalizeSlashes = normalizeSlashes;
function normalizeJoin(...paths) {
    return normalizeSlashes((0, path_1.join)(...paths));
}
exports.normalizeJoin = normalizeJoin;
