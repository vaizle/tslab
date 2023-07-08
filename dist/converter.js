"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.keepNamesInImport = exports.esModuleToCommonJSModule = exports.isCompleteCode = exports.createConverter = void 0;
const path_1 = __importDefault(require("path"));
const semver_1 = __importDefault(require("semver"));
const ts = __importStar(require("@tslab/typescript-for-tslab"));
const util_1 = require("./util");
const tspath_1 = require("./tspath");
// Enable this flag not only in sys instance in createConverter but
// in the entire process to change the behavior watch with ts.sys.watchFile.
// This workaround is necessary to fix #82.
// TODO(yunabe): Instead of enabling this, normalize filenames based on this flag.
ts.sys.useCaseSensitiveFileNames = true;
function asMutable(o) {
    return o;
}
const cancellationToken = {
    isCancellationRequested: () => false,
    throwIfCancellationRequested: () => { },
};
function getTranspileTargets() {
    // TODO(yunabe): Update this rule when new Node.js rules are released.
    // References:
    // https://github.com/microsoft/TypeScript/wiki/Node-Target-Mapping
    // https://github.com/microsoft/TypeScript/issues/22306#issuecomment-412266626
    // https://github.com/microsoft/TypeScript/blob/master/src/lib/es2019.full.d.ts
    const nodeVersion = semver_1.default.major(process.version);
    if (nodeVersion >= 18) {
        return { target: ts.ScriptTarget.ES2022, lib: ["es2022"] };
    }
    if (nodeVersion >= 16) {
        return { target: ts.ScriptTarget.ES2021, lib: ["es2021"] };
    }
    if (nodeVersion >= 14) {
        return { target: ts.ScriptTarget.ES2020, lib: ["es2020"] };
    }
    if (nodeVersion >= 12) {
        return { target: ts.ScriptTarget.ES2019, lib: ["es2019"] };
    }
    return { target: ts.ScriptTarget.ES2018, lib: ["es2018"] };
}
function createConverter(options) {
    const cwd = ts.sys.getCurrentDirectory();
    const srcFilename = (0, tspath_1.normalizeJoin)(cwd, (options === null || options === void 0 ? void 0 : options.isJS) ? "__tslab__.js" : "__tslab__.ts");
    const declFilename = (0, tspath_1.normalizeJoin)(cwd, "__prev__.d.ts");
    const rootFiles = new Set([declFilename, srcFilename]);
    const outDir = "outDir";
    const dstFilename = (0, tspath_1.normalizeJoin)(outDir, "__tslab__.js");
    const dstDeclFilename = (0, tspath_1.normalizeJoin)(outDir, "__tslab__.d.ts");
    const { target: transpileTarget, lib: transpileLib } = getTranspileTargets();
    if (options === null || options === void 0 ? void 0 : options.isBrowser) {
        transpileLib.push("dom");
        transpileLib.push("dom.iterable");
    }
    /**
     * A prefix to sources to handle sources as external modules
     * > any file containing a top-level import or export is considered a module.
     * > https://www.typescriptlang.org/docs/handbook/modules.html#introduction
     */
    const srcPrefix = "export {};" + ts.sys.newLine;
    /** Used in adjustSrcFileOffset */
    const srcPrefixOffsets = {
        offset: srcPrefix.length,
        line: (srcPrefix.match(/\n/g) || []).length,
        char: srcPrefix.length - (srcPrefix.lastIndexOf("\n") + 1),
    };
    let srcContent = "";
    let declContent = "";
    /** Check if external .ts files are converted. */
    const sideInputsConverted = new Set();
    let builder = null;
    const sys = Object.create(ts.sys);
    sys.getCurrentDirectory = function () {
        return cwd;
    };
    let rebuildTimer = null;
    sys.setTimeout = (callback) => {
        // TypeScript compier implements debouncing using a timer.
        // It clears a timer when a new change is notified before the timer
        // is fired and it starts rebuilding sources.
        //
        // In this converter, it often happens when notifyUpdateSrc and
        // notifyUpdateDecls are called in sequence.
        if (rebuildTimer) {
            throw new Error("Unexpected pending rebuildTimer");
        }
        rebuildTimer = {
            callback: () => {
                callback();
                rebuildTimer = null;
            },
        };
        return rebuildTimer;
    };
    sys.clearTimeout = (timeoutId) => {
        if (rebuildTimer === timeoutId) {
            rebuildTimer = null;
            return;
        }
        throw new Error("clearing unexpected tiemr");
    };
    sys.readFile = function (path, encoding) {
        if (path === srcFilename) {
            return srcPrefix + srcContent;
        }
        if (path === declFilename) {
            return srcPrefix + declContent;
        }
        if (virtualFiles.has(path)) {
            return virtualFiles.get(path);
        }
        return ts.sys.readFile(forwardTslabPath(cwd, path), encoding);
    };
    sys.directoryExists = function (path) {
        if (ts.sys.directoryExists(forwardTslabPath(cwd, path))) {
            return true;
        }
        // Fake the existence of node_modules for tslab. This is necessary
        // to import `tslab` when `node_modules` does not exist in `cwd`.
        // See forwardTslabPath for details.
        // TODO: Test this behavior.
        return (0, tspath_1.normalizeJoin)(cwd, "node_modules") === path;
    };
    sys.fileExists = function (path) {
        if (ts.sys.fileExists(forwardTslabPath(cwd, path))) {
            return true;
        }
        return virtualFiles.has(path);
    };
    sys.readDirectory = function (path, extensions, exclude, include, depth) {
        return ts.sys.readDirectory(forwardTslabPath(cwd, path), extensions, exclude, include, depth);
    };
    sys.writeFile = function (path, data) {
        throw new Error("writeFile must not be called");
    };
    let notifyUpdateSrc = null;
    let notifyUpdateDecls = null;
    /** files for modules in memory. `srcPrefix` is prepended to values of virtualFiles. */
    const virtualFiles = new Map();
    const fileWatchers = new Map();
    sys.watchFile = (path, callback, pollingInterval) => {
        if (path === srcFilename) {
            notifyUpdateSrc = callback;
            return {
                close: () => { },
            };
        }
        if (path === declFilename) {
            notifyUpdateDecls = callback;
            return {
                close: () => { },
            };
        }
        // Note: File watchers for real files and virtual files are mixed here.
        // This implementation is not 100% precise, though it causes a minor performance issue.
        const cb = (fileName, eventKind) => {
            sideInputsConverted.delete(fileName);
            callback(fileName, eventKind);
            if (options === null || options === void 0 ? void 0 : options._fileWatcher) {
                options._fileWatcher(fileName, eventKind);
            }
        };
        fileWatchers.set(path, cb);
        const watcher = ts.sys.watchFile(path, cb, pollingInterval);
        return {
            close: () => {
                fileWatchers.delete(path);
                watcher.close();
            },
        };
    };
    // This takes several hundreds millisecs.
    const host = ts.createWatchCompilerHost(Array.from(rootFiles), {
        // module is ESNext, not ES2015, to support dynamic import.
        module: ts.ModuleKind.ESNext,
        // TODO(yunabe): Revisit how to resolve modules in the newer version of NodeJs.
        moduleResolution: ts.ModuleResolutionKind.Node10,
        esModuleInterop: true,
        target: transpileTarget,
        // We need to wrap entries with lib.*.d.ts before passing `lib` though it's not documented clearly.
        // c.f.
        // https://github.com/microsoft/TypeScript/blob/master/src/testRunner/unittests/config/commandLineParsing.ts
        // https://github.com/microsoft/TypeScript/blob/master/src/compiler/commandLineParser.ts
        lib: transpileLib.map((lib) => `lib.${lib}.d.ts`),
        declaration: true,
        newLine: ts.NewLineKind.LineFeed,
        // Remove 'use strict' from outputs.
        noImplicitUseStrict: true,
        experimentalDecorators: true,
        resolveJsonModule: true,
        jsx: ts.JsxEmit.React,
        typeRoots: getTypeRoots(),
        // allowJs, checkJs and outDir are necessary to transpile .js files.
        allowJs: true,
        checkJs: true,
        disableTopLevelAwait: true,
        // tslab does not show error messages in d.ts (e.g. files in @types).
        // This may improve the compile performance slightly.
        skipLibCheck: true,
        // rootDir is necessary to stabilize the paths of output files.
        rootDir: cwd,
        outDir,
        paths: {
            "projects/*": ["projects/*"]
        }
    }, sys, null, function (d) {
        console.log(d.messageText);
    }, function (d) {
        // Drop watch status changes.
    });
    host.afterProgramCreate = function (b) {
        builder = b;
    };
    const watch = ts.createWatchProgram(host);
    if (!builder) {
        throw new Error("builder is not created");
    }
    return {
        close,
        convert,
        inspect,
        complete,
        addModule,
    };
    function close() {
        watch.close();
    }
    function convert(prevDecl, src) {
        updateContent(prevDecl, src);
        let declsFile = builder.getSourceFile(declFilename);
        let srcFile = builder.getSourceFile(srcFilename);
        const locals = srcFile.locals;
        const keys = new Set();
        if (locals) {
            locals.forEach((_, key) => {
                keys.add(key);
            });
        }
        if (keys.size > 0) {
            // Export all local variables.
            // TODO: Disallow "export" in the input.
            const suffix = "\nexport {" + Array.from(keys).join(", ") + "}";
            updateContent(prevDecl, src + suffix);
            declsFile = builder.getSourceFile(declFilename);
            srcFile = builder.getSourceFile(srcFilename);
        }
        asMutable(srcFile).parent = declsFile;
        const diag = convertDiagnostics(getPreEmitDiagnosticsWithDependencies(builder, srcFile));
        if (diag.diagnostics.length > 0) {
            return {
                diagnostics: diag.diagnostics,
            };
        }
        let output;
        let declOutput;
        let lastExpressionVar;
        let sideOutputs;
        for (const dep of getAllSrcDependencies(builder, srcFile)) {
            if (sideInputsConverted.has(dep)) {
                continue;
            }
            if (dep !== srcFilename) {
                sideInputsConverted.add(dep);
            }
            builder.emit(builder.getSourceFile(dep), (fileName, data) => {
                if (fileName === dstFilename) {
                    output = data;
                    return;
                }
                if (fileName === dstDeclFilename) {
                    declOutput = data;
                    return;
                }
                if (!fileName.endsWith(".js")) {
                    return;
                }
                const rel = path_1.default.relative(outDir, fileName);
                if (rel.startsWith("..")) {
                    throw new Error("unexpected emit path: " + fileName);
                }
                if (!sideOutputs) {
                    sideOutputs = [];
                }
                sideOutputs.push({
                    path: (0, tspath_1.normalizeJoin)(cwd, rel),
                    data: esModuleToCommonJSModule(data, transpileTarget),
                });
            }, undefined, undefined, getCustomTransformers(builder.getProgram().getTypeChecker(), declsFile, keys, (name) => {
                lastExpressionVar = name;
            }));
        }
        if (sideOutputs) {
            sideOutputs.sort((a, b) => a.path.localeCompare(b.path));
        }
        declOutput += remainingDecls(builder.getProgram().getTypeChecker(), srcFile, declsFile);
        return {
            output: esModuleToCommonJSModule(output, transpileTarget),
            declOutput,
            diagnostics: diag.diagnostics,
            hasToplevelAwait: diag.hasToplevelAwait,
            sideOutputs,
            lastExpressionVar,
        };
    }
    function getTypeRoots() {
        // If @types/node does not exist in the default type roots,
        // use @types under tslab/node_modules (bug#10).
        // TODO: Integration-test for this behavior.
        const typeRoots = ts.getDefaultTypeRoots(cwd, {
            directoryExists: sys.directoryExists,
        }) || [];
        for (const root of typeRoots) {
            if (ts.sys.fileExists((0, tspath_1.normalizeJoin)(root, "node", "package.json"))) {
                return typeRoots;
            }
        }
        typeRoots.push((0, tspath_1.normalizeJoin)(__dirname, "..", "node_modules", "@types"));
        return typeRoots;
    }
    function inspect(prevDecl, src, position) {
        // c.f.
        // https://github.com/microsoft/vscode/blob/master/extensions/typescript-language-features/src/features/hover.ts
        updateContent(prevDecl, src);
        let declsFile = builder.getSourceFile(declFilename);
        let srcFile = builder.getSourceFile(srcFilename);
        asMutable(srcFile).parent = declsFile;
        const info = ts.getQuickInfoAtPosition(srcFile, builder.getProgram().getTypeChecker(), cancellationToken, position + srcPrefix.length);
        if (info && info.textSpan) {
            info.textSpan.start -= srcPrefix.length;
        }
        return info;
    }
    function complete(prevDecl, src, position) {
        updateContent(prevDecl, src);
        let declsFile = builder.getSourceFile(declFilename);
        let srcFile = builder.getSourceFile(srcFilename);
        asMutable(srcFile).parent = declsFile;
        const pos = position + srcPrefix.length;
        const info = getCompletionsAtPosition(builder.getProgram(), () => {
            // ignore log messages
        }, srcFile, pos, {}, undefined);
        if (info === null || info === void 0 ? void 0 : info.optionalReplacementSpan) {
            info.optionalReplacementSpan.start -= srcPrefix.length;
        }
        const prev = ts.findPrecedingToken(pos, srcFile);
        // Note: In contradiction to the docstring, findPrecedingToken may return prev with
        // prev.end > pos (e.g. `members with surrounding` test case).
        //
        // Note: Be careful. node.pos != node.getStart().
        // (e.g. `globals with prefix` test case)
        if (prev && ts.isIdentifier(prev) && prev.end >= pos) {
            return completionWithId(info, prev, srcFile);
        }
        const next = prev
            ? ts.findNextToken(prev, srcFile, srcFile)
            : null;
        if (next &&
            ts.isIdentifier(next) &&
            next.getStart(srcFile) <= pos &&
            pos <= next.end) {
            return completionWithId(info, next, srcFile);
        }
        let entries = info && info.entries ? info.entries.slice() : [];
        entries.sort((a, b) => {
            const ord = a.sortText.localeCompare(b.sortText);
            return ord !== 0 ? ord : a.name.localeCompare(b.name);
        });
        const candidates = entries.map((e) => e.name);
        return {
            start: pos - srcPrefix.length,
            end: pos - srcPrefix.length,
            candidates,
            original: info,
        };
    }
    // TODO(yunabe): Probably, replace this with optionalReplacementSpan.
    function completionWithId(info, id, srcFile) {
        let name = id.escapedText.toString();
        let lower = name.toLowerCase();
        let entries = info ? info.entries : [];
        const candidates = entries
            .map((e, index) => {
            const key = (() => {
                if (e.name.startsWith(name)) {
                    return "0";
                }
                const lname = e.name.toLowerCase();
                if (lname.toLowerCase().startsWith(lower)) {
                    return "1";
                }
                if (lname.indexOf(lower) >= 0) {
                    return "2";
                }
                return "";
            })();
            if (key === "") {
                return null;
            }
            return {
                name: e.name,
                sortKey: key + e.sortText,
                index,
            };
        })
            .filter((e) => !!e);
        // Sort stably by using the original index.
        candidates.sort((a, b) => {
            const ord = a.sortKey.localeCompare(b.sortKey);
            return ord !== 0 ? ord : a.index - b.index;
        });
        return {
            start: id.getStart(srcFile) - srcPrefix.length,
            end: id.end - srcPrefix.length,
            candidates: candidates.map((e) => e.name),
            original: info,
        };
    }
    function remainingDecls(checker, srcSF, declsSF) {
        const declLocals = declsSF.locals;
        const locals = srcSF.locals;
        let keepMap = new Map();
        function addName(node, name) {
            let set = keepMap.get(node);
            if (!set) {
                set = new Set();
                keepMap.set(node, set);
            }
            set.add(name);
        }
        let valueNames = new Set();
        let anyVars = new Set();
        declLocals.forEach((sym, key) => {
            let keep = checkKeepDeclType(checker, locals.get(key));
            if (!keep.type && !keep.value) {
                return;
            }
            sym.declarations.forEach((decl) => {
                let node = decl;
                while (node.parent !== declsSF) {
                    node = node.parent;
                }
                if (node.kind === ts.SyntaxKind.VariableStatement) {
                    if (keep.value) {
                        addName(node, key);
                        if (anyVars.has(key)) {
                            anyVars.delete(key);
                        }
                        valueNames.add(key);
                    }
                    return;
                }
                if (ts.isTypeAliasDeclaration(node)) {
                    if (keep.type) {
                        addName(node, key);
                    }
                    return;
                }
                if (ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) {
                    if (keep.type) {
                        if (keep.value) {
                            addName(node, key);
                        }
                        // If !keep.value, forget this class.
                        return;
                    }
                    // keep.value === true
                    if (!valueNames.has(node.name.escapedText)) {
                        anyVars.add(node.name.escapedText);
                    }
                    return;
                }
                if (ts.isImportDeclaration(node)) {
                    if (keep.type && keep.value) {
                        addName(node, key);
                        return;
                    }
                    let aliased = checker.getAliasedSymbol(sym);
                    if (!keep.value) {
                        // Here, keep.type == true.
                        if (aliased.flags & ts.SymbolFlags.Value) {
                            // Overwritten with a new value.
                            return;
                        }
                        if (aliased.flags && ts.SymbolFlags.Type) {
                            addName(node, key);
                        }
                        return;
                    }
                    // Here, keep.value == true and keep.type == false.
                    if (aliased.flags & ts.SymbolFlags.Type) {
                        // Overwritten with a new type.
                        if (aliased.flags & ts.SymbolFlags.Value &&
                            !valueNames.has(aliased.escapedName)) {
                            anyVars.add(aliased.escapedName);
                        }
                        return;
                    }
                    addName(node, key);
                    return;
                }
                if (ts.isFunctionDeclaration(node)) {
                    if (keep.value) {
                        addName(node, key);
                    }
                    return;
                }
                if (ts.isInterfaceDeclaration(node)) {
                    if (keep.type) {
                        addName(node, key);
                    }
                }
                // TODO: Support more kinds.
                // console.log(
                //   ts.SyntaxKind[node.kind],
                //   ts.createPrinter({newLine: ts.NewLineKind.LineFeed}).printNode(ts.EmitHint.Unspecified, node, declsSF)
                // );
            });
        });
        let statements = [];
        declsSF.statements.forEach((stmt) => {
            let names = keepMap.get(stmt);
            if (!names) {
                return;
            }
            statements.push(stmt);
            if (ts.isVariableStatement(stmt)) {
                const decls = [];
                stmt.declarationList.declarations.forEach((decl) => {
                    if (!ts.isIdentifier(decl.name)) {
                        // This must not happen.
                        return;
                    }
                    if (!names.has(decl.name.escapedText)) {
                        return;
                    }
                    decls.push(decl);
                });
                asMutable(stmt.declarationList).declarations =
                    ts.factory.createNodeArray(decls);
            }
            if (ts.isImportDeclaration(stmt)) {
                keepNamesInImport(stmt, names);
            }
            // Do nothing for
            // - TypeAliasDeclaration (No multiple specs)
            // - FunctionDeclaration (ditto)
            // - InterfaceDeclaration (ditto)
        });
        asMutable(declsSF).statements = ts.factory.createNodeArray(statements);
        let printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        let anyVarsDecls = [];
        anyVars.forEach((name) => {
            anyVarsDecls.push(`let ${name}: any;\n`);
        });
        return printer.printFile(declsSF) + anyVarsDecls.join("");
    }
    function checkKeepDeclType(checker, symb) {
        const ret = { value: true, type: true };
        if (!symb) {
            return ret;
        }
        if (symb.flags & ts.SymbolFlags.Alias) {
            symb = checker.getAliasedSymbol(symb);
        }
        if (symb.flags & ts.SymbolFlags.Value) {
            ret.value = false;
        }
        if (symb.flags & ts.SymbolFlags.Type) {
            ret.type = false;
        }
        return ret;
    }
    function updateContent(decls, src) {
        const changed = declContent != decls || srcContent != src;
        const oldBuilder = builder;
        declContent = decls;
        srcContent = src;
        notifyUpdateSrc(srcFilename, ts.FileWatcherEventKind.Changed);
        notifyUpdateDecls(declFilename, ts.FileWatcherEventKind.Changed);
        if (!rebuildTimer) {
            throw new Error("rebuildTimer is not set properly");
        }
        rebuildTimer.callback();
        if (builder === oldBuilder && changed) {
            // TypeScript 3.9 checkes if files are updated internally and recreate
            // builder only when files are updated. TypeScript 3.6 did not.
            console.warn("builder is not recreated though contents are changed.");
        }
    }
    /**
     * Check if `d` is a diagnostic from a top-level await.
     * This is used to allow top-level awaits (#16).
     */
    function isTopLevelAwaitDiagnostic(srcFile, d) {
        if (d.code !== 1308 || srcFile == null) {
            // https://github.com/microsoft/TypeScript/search?q=await_expression_is_only_allowed_within_an_async_function_1308
            return false;
        }
        const await = ts.findPrecedingToken(d.start + d.length, srcFile);
        if (await.kind !== ts.SyntaxKind.AwaitKeyword) {
            // This must not happen, though.
            return false;
        }
        let isTop = true;
        let parent = await.parent;
        while (isTop && parent && parent !== srcFile) {
            switch (parent.kind) {
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ModuleDeclaration:
                    // await is not top-level. This is invalid in tslab.
                    return false;
            }
            parent = parent.parent;
        }
        return true;
    }
    function adjustSrcFileOffset(fileName, offset) {
        const lineChar = ts.getLineAndCharacterOfPosition(builder.getSourceFile(fileName), offset);
        const pos = {
            offset: offset,
            line: lineChar.line,
            character: lineChar.character,
        };
        if (fileName === srcFilename || virtualFiles.has(fileName)) {
            pos.offset -= srcPrefixOffsets.offset;
            pos.line -= srcPrefixOffsets.line;
            pos.character -= srcPrefixOffsets.char;
        }
        return pos;
    }
    function convertDiagnostics(input) {
        let hasToplevelAwait = false;
        const diagnostics = [];
        const srcFile = builder.getSourceFile(srcFilename);
        for (const d of input) {
            if (!d.file) {
                continue;
            }
            if (d.file.fileName === srcFilename &&
                isTopLevelAwaitDiagnostic(srcFile, d)) {
                hasToplevelAwait = true;
                continue;
            }
            let fileName;
            if (d.file.fileName !== srcFilename) {
                const rel = path_1.default.relative(cwd, d.file.fileName);
                if (rel.startsWith("..")) {
                    continue;
                }
                fileName = rel;
            }
            const start = adjustSrcFileOffset(d.file.fileName, d.start);
            const end = adjustSrcFileOffset(d.file.fileName, d.start + d.length);
            if (typeof d.messageText === "string") {
                diagnostics.push({
                    start,
                    end,
                    messageText: d.messageText.toString(),
                    category: d.category,
                    code: d.code,
                    fileName,
                });
                continue;
            }
            traverseDiagnosticMessageChain(start, end, d.messageText, diagnostics, fileName);
        }
        return { diagnostics, hasToplevelAwait };
    }
    function traverseDiagnosticMessageChain(start, end, msg, out, fileName) {
        out.push({
            start,
            end,
            messageText: msg.messageText,
            category: msg.category,
            code: msg.code,
        });
        if (!msg.next) {
            return;
        }
        for (const child of msg.next) {
            traverseDiagnosticMessageChain(start, end, child, out);
        }
    }
    /**
     * @param locals A set of names of declared variables.
     * @param setLastExprName A callback to store the created name.
     */
    function getCustomTransformers(checker, declsFile, locals, setLastExprName) {
        const nullTransformationContext = ts.getNullTransformationContext();
        return {
            after: [after],
            afterDeclarations: [afterDeclarations],
        };
        function createLastExprVar() {
            const prefix = "tsLastExpr";
            if (!locals.has(prefix)) {
                return prefix;
            }
            let i = 0;
            while (true) {
                let name = `${prefix}${i}`;
                if (!locals.has(name)) {
                    return name;
                }
                i++;
            }
        }
        // Wrap identifiers to previous variables with exports.
        function wrapPrevIdentifier(node) {
            var _a, _b;
            if (!ts.isIdentifier(node)) {
                return ts.visitEachChild(node, wrapPrevIdentifier, nullTransformationContext);
            }
            if (node.parent &&
                ts.isPropertyAccessExpression(node.parent) &&
                node.parent.name === node) {
                return node;
            }
            let prev = false;
            for (const decl of (_b = (_a = checker.getSymbolAtLocation(node)) === null || _a === void 0 ? void 0 : _a.declarations) !== null && _b !== void 0 ? _b : []) {
                if (decl.getSourceFile() === declsFile) {
                    prev = true;
                    break;
                }
            }
            if (!prev) {
                return node;
            }
            return ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("exports"), node);
        }
        function after() {
            // Rewrite the output to store the last expression to a variable.
            return (node) => {
                node = ts.visitEachChild(node, wrapPrevIdentifier, nullTransformationContext);
                for (let i = node.statements.length - 1; i >= 0; i--) {
                    const stmt = node.statements[i];
                    if (ts.isExportDeclaration(stmt)) {
                        continue;
                    }
                    if (!ts.isExpressionStatement(stmt)) {
                        break;
                    }
                    const lastName = createLastExprVar();
                    let statements = node.statements.slice(0, i);
                    statements.push(ts.factory.createVariableStatement([ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)], ts.factory.createVariableDeclarationList([
                        ts.factory.createVariableDeclaration(lastName, undefined, undefined, stmt.expression),
                    ], ts.NodeFlags.Const)));
                    setLastExprName(lastName);
                    statements.push(...node.statements.slice(i + 1));
                    asMutable(node).statements = ts.factory.createNodeArray(statements);
                    break;
                }
                return node;
            };
        }
        function afterDeclarations() {
            // Delete all exports { ... }
            return (node) => {
                const statements = [];
                for (const stmt of node.statements) {
                    if (ts.isExportDeclaration(stmt)) {
                        continue;
                    }
                    statements.push(stmt);
                }
                asMutable(node).statements = ts.factory.createNodeArray(statements);
                return node;
            };
        }
    }
    function getModuleFilePath(name, meta) {
        if (!(0, util_1.isValidModuleName)(name)) {
            throw new Error("invalid module name: " + JSON.stringify(name));
        }
        let ext = (options === null || options === void 0 ? void 0 : options.isJS) ? ".js" : ".ts";
        if (meta === null || meta === void 0 ? void 0 : meta.jsx) {
            ext += "x";
        }
        return (0, tspath_1.normalizeJoin)(cwd, name + ext);
    }
    function addModule(name, content, meta) {
        return addModuleWithPath(getModuleFilePath(name, meta), content);
    }
    function addModuleWithPath(path, content) {
        content = srcPrefix + content;
        virtualFiles.set(path, content);
        if (fileWatchers.has(path)) {
            fileWatchers.get(path)(path, ts.FileWatcherEventKind.Changed);
        }
        rootFiles.add(path);
        watch.updateRootFileNames(Array.from(rootFiles));
        if (!rebuildTimer) {
            throw new Error("rebuildTimer is not set properly");
        }
        // Note: builder is updated iff content is changed.
        rebuildTimer.callback();
        const file = builder.getSourceFile(path);
        const diags = ts.getPreEmitDiagnostics(builder.getProgram(), file);
        return convertDiagnostics(diags).diagnostics;
    }
}
exports.createConverter = createConverter;
function isCompleteCode(content) {
    if (/(^|\n)\s*\n\s*$/.test(content)) {
        // Force to process src if it ends with two white-space lines.
        return { completed: true };
    }
    const src = ts.createSourceFile("tmp.ts", content, ts.ScriptTarget.Latest, undefined, ts.ScriptKind.TSX);
    const diags = src.parseDiagnostics;
    if (!diags) {
        return { completed: true };
    }
    const end = content.length;
    for (const diag of diags) {
        if (diag.start !== end || diag.length !== 0) {
            continue;
        }
        if (typeof diag.messageText !== "string") {
            continue;
        }
        if (diag.messageText.endsWith(" expected.")) {
            const indent = indentOnEnter(content);
            return { completed: false, indent };
        }
    }
    return { completed: true };
}
exports.isCompleteCode = isCompleteCode;
function indentOnEnter(src) {
    // References:
    // https://code.visualstudio.com/api/language-extensions/language-configuration-guide#indentation-rules
    // https://github.com/microsoft/vscode/blob/master/extensions/typescript-language-features/src/features/languageConfiguration.ts
    let line = src.match(/[^\n]*$/)[0];
    let current = line.match(/^\s*/)[0];
    if (/^((?!.*?\/\*).*\*\/)?\s*[\}\]].*$/.test(line)) {
        // decrease indent
        // TODO: Look into the indent of the previous line.
        if (current.endsWith("  ")) {
            return current.substring(0, current.length - 2);
        }
        if (current.endsWith("\t") || current.endsWith(" ")) {
            return current.substring(0, current.length - 1);
        }
        return current;
    }
    if (/^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/.test(line)) {
        // increase indent
        return current + "  ";
    }
    return current;
}
/*@internal*/
function esModuleToCommonJSModule(js, target) {
    let out = ts.transpileModule(js, {
        fileName: "custom.js",
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            esModuleInterop: true,
            target,
            newLine: ts.NewLineKind.LineFeed,
            // Remove 'use strict' from outputs.
            noImplicitUseStrict: true,
        },
    }).outputText;
    return out;
}
exports.esModuleToCommonJSModule = esModuleToCommonJSModule;
/*@internal*/
function keepNamesInImport(im, names) {
    if (!names || !names.size) {
        throw new Error("names is empty of null");
    }
    let imc = im.importClause;
    if (imc.name && !names.has(imc.name.escapedText)) {
        delete asMutable(imc).name;
    }
    if (imc.namedBindings) {
        if (ts.isNamespaceImport(imc.namedBindings)) {
            if (!names.has(imc.namedBindings.name.escapedText)) {
                delete asMutable(imc).namedBindings;
            }
        }
        else {
            let elms = [];
            imc.namedBindings.elements.forEach((elm) => {
                if (names.has(elm.name.escapedText)) {
                    elms.push(elm);
                }
            });
            if (elms.length) {
                asMutable(imc.namedBindings).elements =
                    ts.factory.createNodeArray(elms);
            }
            else {
                delete asMutable(imc).namedBindings;
            }
        }
    }
    if (!imc.name && !imc.namedBindings) {
        throw new Error("no symbol is included in names");
    }
}
exports.keepNamesInImport = keepNamesInImport;
function getCompletionsAtPosition(program, log, sourceFile, position, preferences, triggerCharacter) {
    const host = {};
    return ts.Completions.getCompletionsAtPositionForTslab(host, program, log, sourceFile, position, preferences, triggerCharacter, ts.CompletionTriggerKind.Invoked, {
        isCancellationRequested: () => false,
        throwIfCancellationRequested: () => void 0,
    });
}
function forwardTslabPath(cwd, path) {
    const rel = path_1.default.relative((0, tspath_1.normalizeJoin)(cwd, "node_modules", "tslab"), path);
    if (rel.startsWith("..")) {
        return path;
    }
    return (0, tspath_1.normalizeJoin)(path_1.default.dirname(__dirname), rel);
}
function getPreEmitDiagnosticsWithDependencies(builder, sourceFile) {
    const files = [sourceFile];
    for (const dep of getAllSrcDependencies(builder, sourceFile)) {
        if (dep !== sourceFile.fileName) {
            files.push(builder.getSourceFile(dep));
        }
    }
    return ts.getPreEmitDiagnosticsOfFiles(builder.getProgram(), files);
}
/**
 * Get a list of all .ts and .js file dependencies (including `sourceFile`) of `sourceFile`.
 */
function getAllSrcDependencies(builder, sourceFile) {
    return builder
        .getAllDependencies(sourceFile)
        .filter((dep) => dep.endsWith(".js") || (dep.endsWith(".ts") && !dep.endsWith(".d.ts")));
}
