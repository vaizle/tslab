"use strict";
/**
 * @file Lightweight utilities. Don't import other libraries to keep this light because this is imported from main.ts,
 * which may just invoke locally-installed tslab.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHTML = exports.TaskCanceledError = exports.TaskQueue = exports.isValidModuleName = exports.getVersion = void 0;
/** A cache of version read from package.json */
let versionCache = null;
/**
 * Get the version string of tslab from package.json.
 */
function getVersion() {
    if (versionCache == null) {
        versionCache = require("../package.json").version;
    }
    return versionCache;
}
exports.getVersion = getVersion;
function isValidModuleName(name) {
    return /^\w+$/.test(name);
}
exports.isValidModuleName = isValidModuleName;
/**
 * TaskQueue executes asynchronous tasks sequentially.
 */
class TaskQueue {
    constructor() {
        this.prev = Promise.resolve();
    }
    /**
     * Adds a new task to the queue.
     *
     * `fn` is not executed immediately even if the queue is empty.
     * Unhandled rejections of promises are not recognized as `UnhandledPromiseRejection`
     * when rejected promises have a subsequent task.
     *
     * @param fn A function executed in this queue.
     */
    add(fn) {
        let promise = this.prev.then(fn, (reason) => {
            if (reason instanceof TaskCanceledError) {
                // Avoid unnecessary deep nesting.
                throw reason;
            }
            throw new TaskCanceledError(reason);
        });
        this.prev = promise;
        return promise;
    }
    reset(delay) {
        if (delay == null) {
            this.prev = Promise.resolve();
            return;
        }
        setTimeout(() => {
            this.reset();
        }, delay);
    }
}
exports.TaskQueue = TaskQueue;
class TaskCanceledError extends Error {
    constructor(reason) {
        super(reason);
        this.name = "TaskCanceledError";
        this.reason = reason;
    }
}
exports.TaskCanceledError = TaskCanceledError;
function escapeHTML(s) {
    /*`&`, "&amp;",
      `'`, "&#39;", // "&#39;" is shorter than "&apos;" and apos was not in HTML until HTML5.
      `<`, "&lt;",
      `>`, "&gt;",
    `"`, "&#34;",
    */
    return s.replace(/[&'<>"]/g, (m) => {
        switch (m) {
            case "&":
                return "&amp;";
            case "'":
                return "&#39;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&#34;";
        }
        // must not happen
        return m;
    });
}
exports.escapeHTML = escapeHTML;
