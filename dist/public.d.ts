/** This is defined to make the docstring of `versions` shorter */
interface Versions {
    tslab: string;
    typescript: string;
    node: string;
}
/** The version strings of tslab and its dependencies. */
export declare const versions: Versions;
export interface Display {
    javascript(s: string): void;
    html(s: string): void;
    markdown(s: string): void;
    latex(s: string): void;
    svg(s: string): void;
    png(b: Uint8Array): void;
    jpeg(b: Uint8Array): void;
    gif(b: Uint8Array): void;
    pdf(b: Uint8Array): void;
    text(s: string): void;
    raw(contentType: string, b: string | Uint8Array): any;
}
/**
 * Returns a new `Display` instance which displays and overwrites a single display-entry.
 */
export declare function newDisplay(): Display;
/**
 * Utility functions to display rich contents in tslab.
 */
export declare const display: Display;
export {};
