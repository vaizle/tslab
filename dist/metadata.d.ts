/**
 * @file Define a function to parse metadat of codeblock in tslab.
 */
export interface CodeMetadata {
    mode?: "node" | "browser";
    module?: string;
    jsx?: true;
}
export declare function getCodeMetadata(src: string): CodeMetadata;
