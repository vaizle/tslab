/// <reference types="node" />
import * as zmq from "zeromq";
import { Executor } from "./executor";
/**
 * The process-wide global variable to hold the last valid
 * writeDisplayData. This is used from the display public API.
 */
export declare let lastWriteDisplayData: (data: DisplayData, update: boolean) => void;
interface ConnectionInfo {
    shell_port: number;
    iopub_port: number;
    stdin_port: number;
    control_port: number;
    hb_port: number;
    ip: string;
    key: string;
    transport: string;
    signature_scheme: string;
    kernel_name: string;
}
interface HeaderMessage {
    version: string;
    /** ISO 8601 timestamp for when the message is created */
    date: string;
    /** typically UUID, should be unique per session */
    session: string;
    username: string;
    msg_type: string;
    /** typically UUID, must be unique per message */
    msg_id: string;
}
interface KernelInfoReply {
    /**
     * Version of messaging protocol.
     * The first integer indicates major version.  It is incremented when
     * there is any backward incompatible change.
     * The second integer indicates minor version.  It is incremented when
     * there is any backward compatible change.
     */
    protocol_version: string;
    /**
     * The kernel implementation name
     * (e.g. 'ipython' for the IPython kernel)
     */
    implementation: string;
    /**
     * Implementation version number.
     * The version number of the kernel's implementation
     * (e.g.IPython.__version__ for the IPython kernel)
     */
    implementation_version: string;
    /**
     * Information about the language of code for the kernel
     */
    language_info: {
        /**
         * Name of the programming language that the kernel implements.
         * Kernel included in IPython returns 'python'.
         */
        name: string;
        /**
         * Language version number.
         * It is Python version number(e.g., '2.7.3') for the kernel
         * included in IPython.
         */
        version: string;
        /**
         * mimetype for script files in this language
         */
        mimetype: string;
        /** Extension including the dot, e.g. '.py' */
        file_extension: string;
        /**
         * Pygments lexer, for highlighting
         * Only needed if it differs from the 'name' field.
         */
        pygments_lexer?: string;
        /**
         * Codemirror mode, for for highlighting in the notebook.
         * Only needed if it differs from the 'name' field.
         */
        codemirror_mode?: string | Object;
        /**
         * Nbconvert exporter, if notebooks written with this kernel should
         * be exported with something other than the general 'script'
         * exporter.
         */
        nbconvert_exporter?: string;
    };
    /**
     * A banner of information about the kernel,
     * which may be desplayed in console environments.
     */
    banner: string;
    /**
     * Optional: A list of dictionaries, each with keys 'text' and 'url'.
     * These will be displayed in the help menu in the notebook UI.
     */
    help_links?: [{
        text: string;
        url: string;
    }];
}
interface ExecuteRequest {
    /**Source code to be executed by the kernel, one or more lines. */
    code: string;
    /**
     * A boolean flag which, if True, signals the kernel to execute
     * this code as quietly as possible.
     * silent=True forces store_history to be False,
     * and will *not*:
     *   - broadcast output on the IOPUB channel
     *   - have an execute_result
     * The default is False.
     */
    silent: boolean;
    store_history: boolean;
    /**
     * A dict mapping names to expressions to be evaluated in the
     * user's dict. The rich display-data representation of each will be evaluated after execution.
     * See the display_data content for the structure of the representation data.
     */
    user_expressions: Object;
    /**
     * Some frontends do not support stdin requests.
     * If this is true, code running in the kernel can prompt the user for input
     * with an input_request message (see below). If it is false, the kernel
     * should not send these messages.
     */
    allow_stdin?: boolean;
    /**
     * A boolean flag, which, if True, does not abort the execution queue, if an exception is encountered.
     * This allows the queued execution of multiple execute_requests, even if they generate exceptions.
     */
    stop_on_error?: boolean;
}
export interface ExecuteReply {
    /** One of: 'ok' OR 'error' OR 'abort' */
    status: string;
    /**
     * The global kernel counter that increases by one with each request that
     * stores history.  This will typically be used by clients to display
     * prompt numbers to the user.  If the request did not store history, this will
     * be the current value of the counter in the kernel.
     */
    execution_count: number;
    /**
     * 'payload' will be a list of payload dicts, and is optional.
     * payloads are considered deprecated.
     * The only requirement of each payload dict is that it have a 'source' key,
     * which is a string classifying the payload (e.g. 'page').
     */
    payload?: Object[];
    /** Results for the user_expressions. */
    user_expressions?: Object;
}
interface IsCompleteRequest {
    /** The code entered so far as a multiline string */
    code: string;
}
interface IsCompleteReply {
    /** One of 'complete', 'incomplete', 'invalid', 'unknown' */
    status: "complete" | "incomplete" | "invalid" | "unknown";
    /**
     * If status is 'incomplete', indent should contain the characters to use
     * to indent the next line. This is only a hint: frontends may ignore it
     * and use their own autoindentation rules. For other statuses, this
     * field does not exist.
     */
    indent?: string;
}
interface InspectRequest {
    /**
     * The code context in which introspection is requested
     * this may be up to an entire multiline cell.
     */
    code: string;
    /**
     * The cursor position within 'code' (in unicode characters) where inspection is requested
     */
    cursor_pos: number;
    /**
     *
     * The level of detail desired.  In IPython, the default (0) is equivalent to typing
     * 'x?' at the prompt, 1 is equivalent to 'x??'.
     * The difference is up to kernels, but in IPython level 1 includes the source code
     * if available.
     */
    detail_level: 0 | 1;
}
interface InspectReply {
    /** 'ok' if the request succeeded or 'error', with error information as in all other replies. */
    status: "ok";
    /** found should be true if an object was found, false otherwise */
    found: boolean;
    /** data can be empty if nothing is found */
    data: {
        [key: string]: string;
    };
    metadata: {
        [key: string]: never;
    };
}
interface CompleteRequest {
    /**
     * The code context in which completion is requested
     * this may be up to an entire multiline cell, such as
     * 'foo = a.isal'
     */
    code: string;
    /** The cursor position within 'code' (in unicode characters) where completion is requested */
    cursor_pos: number;
}
interface CompleteReply {
    /**
     * The list of all matches to the completion request, such as
     * ['a.isalnum', 'a.isalpha'] for the above example.
     */
    matches: string[];
    /**
     * The range of text that should be replaced by the above matches when a completion is accepted.
     * typically cursor_end is the same as cursor_pos in the request.
     */
    cursor_start: number;
    cursor_end: number;
    /** Information that frontend plugins might use for extra display information about completions. */
    metadata: {
        [key: string]: never;
    };
    /**
     * status should be 'ok' unless an exception was raised during the request,
     * in which case it should be 'error', along with the usual error message content
     * in other messages.
     */
    status: "ok";
}
interface ShutdownRequest {
    /**
     * False if final shutdown, or True if shutdown precedes a restart
     */
    restart: boolean;
}
interface ShutdownReply {
    /**
     * False if final shutdown, or True if shutdown precedes a restart
     */
    restart: boolean;
}
interface DisplayData {
    /**
     * Who create the data
     * Used in V4. Removed in V5.
     */
    source?: string;
    /**
     * The data dict contains key/value pairs, where the keys are MIME
     * types and the values are the raw data of the representation in that
     * format.
     */
    data: {
        [key: string]: string | Uint8Array;
    };
    /** Any metadata that describes the data */
    metadata: {
        [key: string]: string;
    };
    /**
     * Optional transient data introduced in 5.1. Information not to be
     * persisted to a notebook or other documents. Intended to live only
     * during a live kernel session.
     */
    transient: {
        display_id?: string;
    };
}
declare class ZmqMessage {
    identity: Buffer;
    delim: string;
    hmac: string;
    header: HeaderMessage;
    parent: HeaderMessage;
    metadata: Object;
    content: Object;
    extra: Buffer[];
    private constructor();
    private static verifyHmac;
    static fromRaw(key: string, raw: Buffer[]): ZmqMessage;
    createReply(): ZmqMessage;
    signAndSend(key: string, sock: any): void;
}
interface JupyterHandler {
    handleKernel(): KernelInfoReply;
    handleExecute(req: ExecuteRequest, writeStream: (name: string, text: string) => void, writeDisplayData: (data: DisplayData, update: boolean) => void): Promise<ExecuteReply>;
    handleIsComplete(req: IsCompleteRequest): IsCompleteReply;
    handleInspect(req: InspectRequest): InspectReply;
    handleComplete(req: CompleteRequest): CompleteReply;
    handleShutdown(req: ShutdownRequest): ShutdownReply;
    /** Release internal resources to terminate the process gracefully. */
    close(): void;
}
export declare class JupyterHandlerImpl implements JupyterHandler {
    private execCount;
    private executor;
    private execQueue;
    /** If true, JavaScript kernel. Otherwise, TypeScript. */
    private isJs;
    constructor(executor: Executor, isJs: boolean);
    handleKernel(): KernelInfoReply;
    handleExecute(req: ExecuteRequest, writeStream: (name: string, text: string) => void, writeDisplayData: (data: DisplayData, update: boolean) => void): Promise<ExecuteReply>;
    /**
     * The body of handleExecute.
     * When the execution failed, this method throws ExecutionCount to
     * - Pass ExecutionCount to the caller.
     * - At the same time, cancel pending tasks on execQueue.
     * TODO: Figure out a cleaner and more natural solution.
     */
    private handleExecuteImpl;
    createWriteToIopub(name: "stdout" | "stderr", writeStream: (name: string, text: string) => void): (buffer: string | Uint8Array, encoding?: string) => boolean;
    handleIsComplete(req: IsCompleteRequest): IsCompleteReply;
    handleInspect(req: InspectRequest): InspectReply;
    handleComplete(req: CompleteRequest): CompleteReply;
    handleShutdown(req: ShutdownRequest): ShutdownReply;
    close(): void;
}
export declare class ZmqServer {
    handler: JupyterHandler;
    configPath: string;
    connInfo: ConnectionInfo;
    iopub: zmq.Publisher;
    shell: zmq.Router;
    control: zmq.Router;
    stdin: zmq.Router;
    hb: zmq.Reply;
    constructor(handler: JupyterHandler, configPath: string);
    private bindSocket;
    publishStatus(status: string, parent: ZmqMessage): void;
    handleShellMessage(sock: zmq.Router, ...args: Buffer[]): Promise<void>;
    handleKernelInfo(sock: any, msg: ZmqMessage): void;
    handleExecute(sock: any, msg: ZmqMessage): Promise<void>;
    handleIsComplete(sock: any, msg: ZmqMessage): void;
    handleInspect(sock: any, msg: ZmqMessage): void;
    handleComplete(sock: any, msg: ZmqMessage): void;
    handleCommInfoRequest(sock: zmq.Router, msg: ZmqMessage): void;
    handleShutdown(sock: any, msg: ZmqMessage): void;
    init(): Promise<void>;
    /** Release internal resources to terminate the process gracefully. */
    close(): void;
}
export {};
