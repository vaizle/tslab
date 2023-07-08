import * as ts from "@tslab/typescript-for-tslab";
import { CodeMetadata } from "./metadata";
export interface SideOutput {
    path: string;
    data: string;
}
export interface ConvertResult {
    output?: string;
    declOutput?: string;
    /**
     * When diagnostics is not empty, other fields are not set.
     */
    diagnostics: Diagnostic[];
    /**
     * The variable name to store the last expression if exists.
     * This is necessary to fix #11
     */
    lastExpressionVar?: string;
    /**
     * If true, the input and the output have top-level await statements.
     */
    hasToplevelAwait?: boolean;
    /**
     * JavaScript outputs from external files in the root dir.
     */
    sideOutputs?: SideOutput[];
}
export interface DiagnosticPos {
    /** Byte-offset. */
    offset: number;
    /** Zero-based line number. */
    line: number;
    /** Zero-based char offset in the line. */
    character: number;
}
export interface Diagnostic {
    start: DiagnosticPos;
    end: DiagnosticPos;
    messageText: string;
    category: number;
    code: number;
    fileName?: string;
}
export interface CompletionInfo {
    start: number;
    end: number;
    candidates: string[];
    /**
     * The original completion from TS compiler.
     * It's exposed for debugging purpuse.
     */
    original?: ts.CompletionInfo;
}
export interface IsCompleteResult {
    completed: boolean;
    indent?: string;
}
export interface ConverterOptions {
    /** If true, JavaScript mode. TypeSceript mode otherwise */
    isJS?: boolean;
    /** If true, creates a converter for browser mode. Otherwise, Node.js */
    isBrowser?: boolean;
    /** Only for testing. File changes are forwarded to this handler. */
    _fileWatcher?: ts.FileWatcherCallback;
}
export interface Converter {
    convert(prevDecl: string, src: string): ConvertResult;
    inspect(prevDecl: string, src: string, position: number): ts.QuickInfo;
    complete(prevDecl: string, src: string, position: number): CompletionInfo;
    /** Release internal resources to terminate the process gracefully. */
    close(): void;
    /** Defines a in-memory module */
    addModule(name: string, content: string, meta?: CodeMetadata): Diagnostic[];
}
export declare function createConverter(options?: ConverterOptions): Converter;
export declare function isCompleteCode(content: string): IsCompleteResult;
export declare function esModuleToCommonJSModule(js: string, target: ts.ScriptTarget): string;
export declare function keepNamesInImport(im: ts.ImportDeclaration, names: Set<ts.__String>): void;
