/**
 * Start the Jupyter kernel.
 *
 * This method can be imported from the globally-installed tslab (https://github.com/yunabe/tslab/issues/4),
 * whose version can be differnt from locally-installed tslab.
 * Thus, we should not rename, move or change the interface of startKernel for backward compatibiliy.
 */
export declare function startKernel({ configPath, enableFindLocal, jsKernel, globalVersion, }: {
    configPath?: string;
    enableFindLocal?: boolean;
    jsKernel?: boolean;
    globalVersion?: string;
}): void;
export declare function main(): void;
