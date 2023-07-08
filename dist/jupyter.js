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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZmqServer = exports.JupyterHandlerImpl = exports.lastWriteDisplayData = void 0;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const converter_1 = require("./converter");
const inspect_1 = require("./inspect");
const util_2 = require("./util");
const utf8Decoder = new util_1.TextDecoder();
/**
 * The process-wide global variable to hold the last valid
 * writeDisplayData. This is used from the display public API.
 */
exports.lastWriteDisplayData = null;
class ZmqMessage {
    constructor() { }
    static verifyHmac(key, hmac, rest) {
        const hash = (0, crypto_1.createHmac)("sha256", key);
        for (const r of rest) {
            hash.update(r);
        }
        const hex = hash.digest("hex");
        if (hex == hmac) {
            return;
        }
        throw new Error(`invalid hmac ${hmac}; want ${hex}`);
    }
    static fromRaw(key, raw) {
        const ret = new ZmqMessage();
        ret.identity = raw[0];
        ret.delim = raw[1].toString();
        ret.hmac = raw[2].toString();
        ret.header = JSON.parse(raw[3].toString());
        ret.parent = JSON.parse(raw[4].toString());
        ret.metadata = JSON.parse(raw[5].toString());
        ret.content = JSON.parse(raw[6].toString());
        ret.extra = raw.slice(7);
        ZmqMessage.verifyHmac(key, ret.hmac, raw.slice(3));
        return ret;
    }
    createReply() {
        const rep = new ZmqMessage();
        // https://github.com/ipython/ipykernel/blob/master/ipykernel/kernelbase.py#L222
        // idents must be copied from the parent.
        rep.identity = this.identity;
        rep.delim = this.delim;
        // Sets an empty string to hmac because it won't be used.
        rep.hmac = "";
        rep.header = {
            version: "5.3",
            date: new Date().toISOString(),
            session: this.header.session,
            username: this.header.username,
            msg_type: this.header.msg_type,
            // Set a unique ID to prevent a problem like #14.
            // TODO: Check this by integration tests.
            msg_id: (0, crypto_1.randomBytes)(16).toString("hex"),
        };
        rep.parent = this.header;
        rep.metadata = {};
        rep.content = {};
        rep.extra = [];
        return rep;
    }
    signAndSend(key, sock) {
        const heads = [];
        heads.push(this.identity);
        heads.push(this.delim);
        const bodies = [];
        bodies.push(JSON.stringify(this.header));
        bodies.push(JSON.stringify(this.parent));
        bodies.push(JSON.stringify(this.metadata));
        bodies.push(JSON.stringify(this.content));
        for (const e of this.extra) {
            bodies.push(JSON.stringify(e));
        }
        const hash = (0, crypto_1.createHmac)("sha256", key);
        for (const b of bodies) {
            hash.update(b);
        }
        heads.push(hash.digest("hex"));
        sock.send(heads.concat(bodies));
    }
}
class ExecutionCount {
    constructor(count) {
        this.count = count;
    }
}
class JupyterHandlerImpl {
    constructor(executor, isJs) {
        this.execCount = 0;
        this.executor = executor;
        this.execQueue = new util_2.TaskQueue();
        this.isJs = isJs;
    }
    handleKernel() {
        let lang = "typescript";
        let version = "3.7.2";
        let implementation = "tslab";
        let file_extension = ".ts";
        let banner = "TypeScript";
        let mimetype = "text/typescript";
        if (this.isJs) {
            lang = "javascript";
            version = "";
            implementation = "jslab";
            file_extension = ".js";
            banner = "JavaScript";
            mimetype = "text/javascript";
        }
        const reply = {
            protocol_version: "5.3",
            implementation,
            implementation_version: "1.0.0",
            language_info: {
                name: lang,
                version,
                mimetype,
                file_extension,
            },
            banner,
        };
        if (!this.isJs) {
            // This fix https://github.com/yunabe/tslab/issues/18 in both Jupyter notebook and JupyterLab magically.
            reply.language_info.codemirror_mode = {
                // mode is used to enable TypeScript CodeMirror in jupyterlab:
                // https://github.com/jupyterlab/jupyterlab/blob/1377bd183764860b384bea7c36ea1c52b6095e05/packages/codemirror/src/mode.ts#L133
                // As we can see in the code, jupyterlab does not pass codemirror_mode to CodeMirror directly.
                // Thus, `typescript: true` below is not used in jupyterlab.
                mode: "typescript",
                // name and typescript are used to enable TypeScript CodeMirror in notebook.
                // We don't fully understand why this combination works magically. It might be related to:
                // https://github.com/jupyter/notebook/blob/8b21329deb9dd04271b12e3d2790c5be9f1fd51e/notebook/static/notebook/js/notebook.js#L2199
                // Also, typescript flag is defined in:
                // https://codemirror.net/mode/javascript/index.html
                name: "javascript",
                typescript: true,
            };
        }
        return reply;
    }
    async handleExecute(req, writeStream, writeDisplayData) {
        let status = "ok";
        let count = null;
        try {
            count = await this.execQueue.add(() => this.handleExecuteImpl(req, writeStream, writeDisplayData));
        }
        catch (e) {
            if (e instanceof ExecutionCount) {
                status = "error";
                count = e;
            }
            else if (e instanceof util_2.TaskCanceledError) {
                status = "abort";
            }
            else {
                status = "error";
                console.error("unexpected error:", e);
            }
            if (status === "error") {
                // Sleep 200ms to abort all pending tasks in ZMQ queue then reset the task queue.
                // https://github.com/yunabe/tslab/issues/19
                // We might just need to sleep 1ms here to process all pending requests in ZMQ.
                // But we wait for 200ms for safety. 200ms is selected from:
                // https://material.io/design/motion/speed.html#duration
                this.execQueue.reset(200);
            }
        }
        return {
            status: status,
            execution_count: count ? count.count : undefined,
        };
    }
    /**
     * The body of handleExecute.
     * When the execution failed, this method throws ExecutionCount to
     * - Pass ExecutionCount to the caller.
     * - At the same time, cancel pending tasks on execQueue.
     * TODO: Figure out a cleaner and more natural solution.
     */
    async handleExecuteImpl(req, writeStream, writeDisplayData) {
        // Python kernel forward outputs to the cell even after the execution is finished.
        // We follow the same convension here.
        process.stdout.write = this.createWriteToIopub("stdout", writeStream);
        process.stderr.write = this.createWriteToIopub("stderr", writeStream);
        exports.lastWriteDisplayData = writeDisplayData;
        let count = new ExecutionCount(++this.execCount);
        let ok = await this.executor.execute(req.code);
        if (!ok) {
            throw count;
        }
        return count;
    }
    createWriteToIopub(name, writeStream) {
        return (buffer, encoding) => {
            let text;
            if (typeof buffer === "string") {
                text = buffer;
            }
            else {
                text = utf8Decoder.decode(buffer);
            }
            writeStream(name, text);
            return true;
        };
    }
    handleIsComplete(req) {
        const res = (0, converter_1.isCompleteCode)(req.code);
        if (res.completed) {
            return {
                status: "complete",
            };
        }
        return {
            indent: res.indent,
            status: "incomplete",
        };
    }
    handleInspect(req) {
        const info = this.executor.inspect(req.code, req.cursor_pos);
        if (!info) {
            return {
                status: "ok",
                found: false,
                data: {},
                metadata: {},
            };
        }
        let text = (0, inspect_1.printQuickInfo)(info);
        return {
            status: "ok",
            found: true,
            data: {
                // text/plain must be filled even if "text/html" is provided.
                // TODO: Fill text/html too if necessary.
                "text/plain": text,
            },
            metadata: {},
        };
    }
    handleComplete(req) {
        const info = this.executor.complete(req.code, req.cursor_pos);
        return {
            cursor_start: info.start,
            cursor_end: info.end,
            matches: info.candidates,
            metadata: {},
            status: "ok",
        };
    }
    handleShutdown(req) {
        return {
            restart: false,
        };
    }
    close() {
        this.executor.close();
    }
}
exports.JupyterHandlerImpl = JupyterHandlerImpl;
class ZmqServer {
    constructor(handler, configPath) {
        this.handler = handler;
        this.configPath = configPath;
    }
    async bindSocket(sock, port) {
        const conn = this.connInfo;
        const addr = `${conn.transport}://${conn.ip}:${port}`;
        await sock.bind(addr);
    }
    publishStatus(status, parent) {
        const reply = parent.createReply();
        reply.content = {
            execution_state: status,
        };
        reply.header.msg_type = "status";
        reply.signAndSend(this.connInfo.key, this.iopub);
    }
    async handleShellMessage(sock, ...args) {
        const msg = ZmqMessage.fromRaw(this.connInfo.key, args);
        let terminated = false;
        this.publishStatus("busy", msg);
        try {
            switch (msg.header.msg_type) {
                case "kernel_info_request":
                    this.handleKernelInfo(sock, msg);
                    break;
                case "execute_request":
                    await this.handleExecute(sock, msg);
                    break;
                case "is_complete_request":
                    this.handleIsComplete(sock, msg);
                    break;
                case "inspect_request":
                    this.handleInspect(sock, msg);
                    break;
                case "complete_request":
                    this.handleComplete(sock, msg);
                    break;
                case "comm_info_request":
                    // This is sent for ipywidgets with content = { target_name: 'jupyter.widget' }.
                    this.handleCommInfoRequest(sock, msg);
                    break;
                case "shutdown_request":
                    this.handleShutdown(sock, msg);
                    terminated = true;
                    break;
                default:
                    console.warn(`unknown msg_type: ${msg.header.msg_type}`);
            }
        }
        finally {
            this.publishStatus("idle", msg);
        }
        if (terminated) {
            // TODO: Write tests for the graceful termination.
            this.close();
        }
    }
    handleKernelInfo(sock, msg) {
        const reply = msg.createReply();
        reply.header.msg_type = "kernel_info_reply";
        reply.content = this.handler.handleKernel();
        reply.signAndSend(this.connInfo.key, sock);
    }
    async handleExecute(sock, msg) {
        const reply = msg.createReply();
        reply.header.msg_type = "execute_reply";
        const writeStream = (name, text) => {
            const reply = msg.createReply();
            reply.header.msg_type = "stream";
            reply.content = {
                name,
                text,
            };
            reply.signAndSend(this.connInfo.key, this.iopub);
        };
        const writeDisplayData = (data, update) => {
            const reply = msg.createReply();
            reply.header.msg_type = update ? "update_display_data" : "display_data";
            reply.content = data;
            reply.signAndSend(this.connInfo.key, this.iopub);
        };
        const content = await this.handler.handleExecute(msg.content, writeStream, writeDisplayData);
        reply.content = content;
        reply.signAndSend(this.connInfo.key, sock);
    }
    handleIsComplete(sock, msg) {
        const reply = msg.createReply();
        reply.header.msg_type = "is_complete_reply";
        reply.content = this.handler.handleIsComplete(msg.content);
        reply.signAndSend(this.connInfo.key, sock);
    }
    handleInspect(sock, msg) {
        const reply = msg.createReply();
        reply.header.msg_type = "inspect_reply";
        reply.content = this.handler.handleInspect(msg.content);
        reply.signAndSend(this.connInfo.key, sock);
    }
    handleComplete(sock, msg) {
        const reply = msg.createReply();
        reply.header.msg_type = "complete_reply";
        reply.content = this.handler.handleComplete(msg.content);
        reply.signAndSend(this.connInfo.key, sock);
    }
    handleCommInfoRequest(sock, msg) {
        const reply = msg.createReply();
        reply.header.msg_type = "complete_reply";
        // comm is not supported in tslab now. Returns an empty comms.
        reply.content = { comms: {} };
        reply.signAndSend(this.connInfo.key, sock);
    }
    handleShutdown(sock, msg) {
        const reply = msg.createReply();
        reply.header.msg_type = "shutdown_reply";
        reply.content = this.handler.handleShutdown(msg.content);
        reply.signAndSend(this.connInfo.key, sock);
    }
    async init() {
        const cinfo = JSON.parse(fs_1.default.readFileSync(this.configPath, "utf-8"));
        this.connInfo = cinfo;
        // https://zeromq.github.io/zeromq.js/index.html
        // zeromq runtime must be delay loaded so that mutiple instances of
        // this module can be loaded (e.g. global and local ones).
        const zmq = await Promise.resolve().then(() => __importStar(require("zeromq")));
        this.iopub = new zmq.Publisher();
        this.shell = new zmq.Router();
        this.control = new zmq.Router();
        this.stdin = new zmq.Router();
        this.hb = new zmq.Reply();
        (async () => {
            var _a, e_1, _b, _c;
            try {
                // These for-loops exist when sockets are closed.
                for (var _d = true, _e = __asyncValues(this.shell), _f; _f = await _e.next(), _a = _f.done, !_a;) {
                    _c = _f.value;
                    _d = false;
                    try {
                        const msgs = _c;
                        this.handleShellMessage(this.shell, ...msgs);
                    }
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
        })();
        (async () => {
            var _a, e_2, _b, _c;
            try {
                for (var _d = true, _e = __asyncValues(this.control), _f; _f = await _e.next(), _a = _f.done, !_a;) {
                    _c = _f.value;
                    _d = false;
                    try {
                        const msgs = _c;
                        this.handleShellMessage(this.control, ...msgs);
                    }
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                }
                finally { if (e_2) throw e_2.error; }
            }
        })();
        (async () => {
            var _a, e_3, _b, _c;
            try {
                for (var _d = true, _e = __asyncValues(this.hb), _f; _f = await _e.next(), _a = _f.done, !_a;) {
                    _c = _f.value;
                    _d = false;
                    try {
                        const msgs = _c;
                        // hb is only used by `jupyter console`.
                        // TODO: Test this behavior by integration tests.
                        this.hb.send(msgs);
                    }
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                }
                finally { if (e_3) throw e_3.error; }
            }
        })();
        await Promise.all([
            this.bindSocket(this.iopub, cinfo.iopub_port),
            this.bindSocket(this.shell, cinfo.shell_port),
            this.bindSocket(this.control, cinfo.control_port),
            this.bindSocket(this.stdin, cinfo.stdin_port),
            this.bindSocket(this.hb, cinfo.hb_port),
        ]);
    }
    /** Release internal resources to terminate the process gracefully. */
    close() {
        // First internal resources (e.g. ts watcher in converter).
        this.handler.close();
        // Then, close sockets.
        this.iopub.close();
        this.shell.close();
        this.control.close();
        this.stdin.close();
        this.hb.close();
    }
}
exports.ZmqServer = ZmqServer;
