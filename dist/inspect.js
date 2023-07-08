"use strict";
/**
 * getQuickInfoAtPosition and necessary functions cloned from TypeScript services.ts.
 * TODO: Use TypeScript or branched TypeScript library instead of copying these functions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.printQuickInfo = void 0;
function tagText(tag) {
    if (!tag.text) {
        return "";
    }
    const out = [];
    for (const t of tag.text) {
        out.push(t.text);
    }
    return out.join("");
}
function printQuickInfo(info) {
    let out = [];
    const parts = info.displayParts || [];
    const docs = info.documentation || [];
    const tags = info.tags || [];
    for (const part of parts) {
        out.push(part.text);
    }
    if (out.length > 0 && (docs.length > 0 || tags.length > 0)) {
        out.push("\n");
    }
    for (const doc of docs) {
        out.push("\n");
        out.push(doc.text);
    }
    for (const tag of tags) {
        let text = tagText(tag);
        if (!text) {
            continue;
        }
        if (tagText)
            if (tag.name === "param") {
                text = "@param " + text;
            }
        out.push("\n");
        out.push(text);
    }
    return out.join("");
}
exports.printQuickInfo = printQuickInfo;
