"use strict";
/**
 * @file Define a function to parse metadat of codeblock in tslab.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCodeMetadata = void 0;
const util_1 = require("./util");
const ts = __importStar(require("@tslab/typescript-for-tslab"));
function getCodeMetadata(src) {
    var _a;
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, 
    /* skipTrivia */ false);
    scanner.setLanguageVariant(ts.LanguageVariant.Standard);
    scanner.setText(src);
    const out = {};
    while (true) {
        const kind = scanner.scan();
        if (kind < ts.SyntaxKind.FirstTriviaToken ||
            kind > ts.SyntaxKind.LastTriviaToken) {
            break;
        }
        if (kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
            // Skip trivia tokens.
            continue;
        }
        const text = scanner.getTokenText();
        const ret = ts.parseIsolatedJSDocComment(text);
        if (!ret) {
            // Not JSDoc (e.g. /* comment */)
            continue;
        }
        if ((_a = ret.diagnostics) === null || _a === void 0 ? void 0 : _a.length) {
            continue;
        }
        const jsDoc = ret.jsDoc;
        if (!jsDoc || !jsDoc.tags) {
            continue;
        }
        for (const tag of jsDoc.tags) {
            const tagName = tag.tagName.escapedText;
            if (tagName === "module" &&
                typeof tag.comment == "string" &&
                (0, util_1.isValidModuleName)(tag.comment)) {
                out.module = tag.comment;
            }
            else if (tagName === "jsx") {
                out.jsx = true;
            }
            else if (tagName === "node") {
                out.mode = "node";
            }
            else if (tagName === "browser") {
                out.mode = "browser";
            }
        }
    }
    return out;
}
exports.getCodeMetadata = getCodeMetadata;
