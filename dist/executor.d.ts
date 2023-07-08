/// <reference types="node" />
import * as ts from "@tslab/typescript-for-tslab";
import { Converter, CompletionInfo } from "./converter";
export interface ConverterSet {
    /** The converter for Node.js code */
    node: Converter;
    /** The converter for browser code */
    browser: Converter;
    close: () => void;
}
export interface Executor {
    /**
     * Transpiles and executes `src`.
     *
     * Note: Although this method returns a promise, `src` is executed immdiately
     * when this code is executed.
     * @param src source code to be executed.
     * @returns Whether `src` was executed successfully.
     */
    execute(src: string): Promise<boolean>;
    inspect(src: string, position: number): ts.QuickInfo;
    complete(src: string, positin: number): CompletionInfo;
    reset(): void;
    /**
     * Interrupts non-blocking code execution. This method is called from SIGINT signal handler.
     * Note that blocking code execution is terminated by SIGINT separately because it is impossible
     * to call `interrupt` while `execute` is blocked.
     */
    interrupt(): void;
    /** locals exposes tslab local variables for unit tests. */
    locals: {
        [key: string]: any;
    };
    /** Release internal resources to terminate the process gracefully. */
    close(): void;
}
export interface ConsoleInterface {
    log(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
}
/**
 * createRequire creates `require` which resolves modules from `rootDir`.
 */
export declare function createRequire(rootDir: string): NodeJS.Require;
export declare function createExecutor(rootDir: string, convs: ConverterSet, console: ConsoleInterface): Executor;
