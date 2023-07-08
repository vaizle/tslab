/**
 * @file Lightweight utilities. Don't import other libraries to keep this light because this is imported from main.ts,
 * which may just invoke locally-installed tslab.
 */
/**
 * Get the version string of tslab from package.json.
 */
export declare function getVersion(): string;
export declare function isValidModuleName(name: string): boolean;
/**
 * TaskQueue executes asynchronous tasks sequentially.
 */
export declare class TaskQueue {
    private prev;
    constructor();
    /**
     * Adds a new task to the queue.
     *
     * `fn` is not executed immediately even if the queue is empty.
     * Unhandled rejections of promises are not recognized as `UnhandledPromiseRejection`
     * when rejected promises have a subsequent task.
     *
     * @param fn A function executed in this queue.
     */
    add<T>(fn: () => Promise<T>): Promise<T>;
    reset(delay?: number): void;
}
export declare class TaskCanceledError extends Error {
    /** The root cause of this cancellation. */
    reason: any;
    constructor(reason: any);
}
export declare function escapeHTML(s: string): string;
