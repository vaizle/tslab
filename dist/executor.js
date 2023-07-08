"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExecutor = exports.createRequire = void 0;
const path_1 = __importDefault(require("path"));
const vm_1 = __importDefault(require("vm"));
const module_1 = __importDefault(require("module"));
const metadata_1 = require("./metadata");
const tspath_1 = require("./tspath");
/**
 * createRequire creates `require` which resolves modules from `rootDir`.
 */
function createRequire(rootDir) {
    return module_1.default.createRequire((0, tspath_1.normalizeJoin)(rootDir, "src.js"));
}
exports.createRequire = createRequire;
/**
 * Wrap `require` to hook import of tslab and imports from sideOutputs.
 */
function wrapRequire(req, dirname, sideOutputs, sideModules) {
    function requireFromSideOutputs(id) {
        let filename = (0, tspath_1.normalizeJoin)(dirname, id);
        if (id.indexOf("projects/") === 0) {
            filename = dirname.split("projects")[0] + '/' + id;
            filename = filename.replace('//', '/');
        }
        if (path_1.default.extname(filename) === "") {
            filename += ".js";
        }
        const cached = sideModules.get(filename);
        if (cached) {
            return cached.exports;
        }
        if (!sideOutputs.has(filename)) {
            return null;
        }
        const mod = new module_1.default(filename, module);
        // Emulate load of Module:
        // https://github.com/nodejs/node/blob/118b28abed73f82f0d6aab33031edfc78934d90f/lib/internal/modules/cjs/loader.js#L1033
        mod.filename = filename;
        mod.paths = module_1.default["_nodeModulePaths"](path_1.default.dirname(filename));
        // Wrap require to hook tslab and imports from sideOutputs.
        mod.require = wrapRequire(mod.require, path_1.default.dirname(filename), sideOutputs, sideModules);
        mod._compile(sideOutputs.get(filename), filename);
        sideModules.set(filename, mod);
        return mod.exports;
    }
    return new Proxy(req, {
        // TODO: Test this behavior.
        apply: (_target, thisArg, argArray) => {
            if (argArray.length !== 1) {
                return req.apply(thisArg, argArray);
            }
            const arg = argArray[0];
            if (arg === "tslab") {
                // Hook require('tslab').
                return require("..");
            }
            const mod = requireFromSideOutputs(arg);
            if (mod) {
                return mod;
            }
            return req.apply(thisArg, argArray);
        },
    });
}
function createExecutor(rootDir, convs, console) {
    const sideOutputs = new Map();
    const sideModules = new Map();
    function updateSideOutputs(outs) {
        for (const out of outs) {
            if (sideModules.has(out.path)) {
                sideModules.delete(out.path);
            }
            sideOutputs.set(out.path, out.data);
        }
    }
    const exports = createExports();
    const req = wrapRequire(createRequire(rootDir), rootDir, sideOutputs, sideModules);
    // Set __tslab__ to pass `exports` and `require` to the code.
    // We need to wrapthe code with runInThisContext rather than
    // setting __tslab__ to globalThis directory because jest
    // hooks accesses to global variables.
    vm_1.default.runInThisContext("(x) => {globalThis.__tslab__ = x; }")({
        exports,
        require: req,
    });
    let prevDecl = "";
    let interrupted = new Error("Interrupted asynchronously");
    let rejectInterruptPromise;
    let interruptPromise;
    function resetInterruptPromise() {
        interruptPromise = new Promise((_, reject) => {
            rejectInterruptPromise = reject;
        });
        // Suppress "UnhandledPromiseRejectionWarning".
        interruptPromise.catch(() => { });
    }
    resetInterruptPromise();
    function interrupt() {
        rejectInterruptPromise(interrupted);
        resetInterruptPromise();
    }
    function createExports() {
        const exports = {};
        return new Proxy(exports, {
            // We need to handle defineProperty as set because TypeScript converts
            // named imports to defineProperty but we want to named imported symbols rewritable.
            defineProperty: (_target, prop, attrs) => {
                if (prop === "__esModule") {
                    return true;
                }
                if (attrs.get) {
                    exports[prop] = attrs.get();
                }
                else {
                    exports[prop] = attrs.value;
                }
                return true;
            },
        });
    }
    function printDiagnostics(diagnostics) {
        for (const diag of diagnostics) {
            console.error("%s%d:%d - %s", diag.fileName ? diag.fileName + " " : "", diag.start.line + 1, diag.start.character + 1, diag.messageText);
        }
    }
    async function execute(src) {
        const meta = (0, metadata_1.getCodeMetadata)(src);
        if (meta.module) {
            const conv = meta.mode === "browser" ? convs.browser : convs.node;
            printDiagnostics(conv.addModule(meta.module, src, meta));
            // Always returns true because modules are registered regardless of errors in src.
            return true;
        }
        if (meta.mode === "browser") {
            // TODO: Bundle and display browser JS
            return true;
        }
        const converted = convs.node.convert(prevDecl, src);
        if (converted.sideOutputs) {
            updateSideOutputs(converted.sideOutputs);
        }
        if (converted.diagnostics.length > 0) {
            printDiagnostics(converted.diagnostics);
            return false;
        }
        if (!converted.output) {
            prevDecl = converted.declOutput || "";
            return true;
        }
        let promise = null;
        try {
            // Wrap code with (function(){...}) to improve the performance (#11)
            // Also, it's necessary to redeclare let and const in tslab.
            const prefix = converted.hasToplevelAwait
                ? "(async function(exports, require) { "
                : "(function(exports, require) { ";
            const wrapped = prefix +
                converted.output +
                "\n})(__tslab__.exports, __tslab__.require)";
            const ret = vm_1.default.runInThisContext(wrapped, {
                breakOnSigint: true,
            });
            if (converted.hasToplevelAwait) {
                promise = ret;
            }
        }
        catch (e) {
            console.error(e);
            return false;
        }
        if (promise) {
            try {
                await Promise.race([promise, interruptPromise]);
            }
            catch (e) {
                console.error(e);
                return false;
            }
        }
        prevDecl = converted.declOutput || "";
        if (converted.lastExpressionVar &&
            exports[converted.lastExpressionVar] != null) {
            let ret = exports[converted.lastExpressionVar];
            delete exports[converted.lastExpressionVar];
            console.log(ret);
        }
        return true;
    }
    function inspect(src, position) {
        const conv = (0, metadata_1.getCodeMetadata)(src).mode === "browser" ? convs.browser : convs.node;
        return conv.inspect(prevDecl, src, position);
    }
    function complete(src, position) {
        const conv = (0, metadata_1.getCodeMetadata)(src).mode === "browser" ? convs.browser : convs.node;
        return conv.complete(prevDecl, src, position);
    }
    function reset() {
        prevDecl = "";
        for (const name of Object.getOwnPropertyNames(exports)) {
            delete exports[name];
        }
    }
    function close() {
        convs.close();
    }
    return {
        execute,
        inspect,
        complete,
        locals: exports,
        reset,
        interrupt,
        close,
    };
}
exports.createExecutor = createExecutor;
