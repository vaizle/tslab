"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = exports.startKernel = void 0;
const fs_1 = __importDefault(require("fs"));
const child_process_1 = __importDefault(require("child_process"));
const path_1 = __importDefault(require("path"));
const commander_1 = require("commander");
const converter_1 = require("./converter");
const util_1 = require("./util");
const executor_1 = require("./executor");
const jupyter_1 = require("./jupyter");
class ConverterSetImpl {
    constructor(jsKernel) {
        this.jsKernel = jsKernel;
    }
    get node() {
        if (!this._node) {
            this._node = (0, converter_1.createConverter)({ isJS: this.jsKernel, isBrowser: false });
        }
        return this._node;
    }
    get browser() {
        if (!this._browser) {
            this._browser = (0, converter_1.createConverter)({ isJS: this.jsKernel, isBrowser: true });
        }
        return this._browser;
    }
    close() {
        if (this._node) {
            this._node.close();
        }
        if (this._browser) {
            this._browser.close();
        }
    }
}
function* traverseAncestorDirs(dir) {
    for (let level = 0;; level++) {
        yield { dir, level };
        const parent = path_1.default.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
}
const mainPath = ["node_modules", "tslab", "dist", "main.js"];
function findLocalStartKernel() {
    for (const { dir, level } of traverseAncestorDirs(process.cwd())) {
        if (path_1.default.basename(dir) == "node_modules") {
            continue;
        }
        if (!fs_1.default.existsSync(path_1.default.join(dir, ...mainPath))) {
            continue;
        }
        const reqPath = ["."];
        for (let i = 0; i < level; i++) {
            reqPath.push("..");
        }
        reqPath.push(...mainPath);
        const { startKernel } = (0, executor_1.createRequire)(process.cwd())(reqPath.join("/"));
        return startKernel;
    }
    return null;
}
/**
 * Start the Jupyter kernel.
 *
 * This method can be imported from the globally-installed tslab (https://github.com/yunabe/tslab/issues/4),
 * whose version can be differnt from locally-installed tslab.
 * Thus, we should not rename, move or change the interface of startKernel for backward compatibiliy.
 */
function startKernel({ configPath = "", enableFindLocal = true, jsKernel = false, globalVersion = "", }) {
    if (enableFindLocal) {
        const local = findLocalStartKernel();
        if (local) {
            local({ configPath, enableFindLocal: false, jsKernel, globalVersion });
            return;
        }
    }
    const convs = new ConverterSetImpl(jsKernel);
    convs.node; // Warm the converter for Node.js
    const executor = (0, executor_1.createExecutor)(process.cwd(), convs, {
        log: console.log,
        error: console.error,
    });
    const server = new jupyter_1.ZmqServer(new jupyter_1.JupyterHandlerImpl(executor, jsKernel), configPath);
    process.on("SIGINT", () => {
        executor.interrupt();
    });
    // TODO: Test these handlers.
    process.on("uncaughtException", (err) => {
        console.error("UncaughtException:", err);
    });
    process.on("unhandledRejection", (reason) => {
        console.error("UnhandledPromiseRejection:", reason);
    });
    server.init();
}
exports.startKernel = startKernel;
function main() {
    let defaultPy = "python3";
    let defaultBinary = "tslab";
    if (process.platform === "win32") {
        // Windows does not have a convention to install Python3.x as python3.
        defaultPy = "python";
        // In Windows, we need to use a batch file created by npm install.
        defaultBinary = "tslab.cmd";
    }
    commander_1.program.version("tslab " + (0, util_1.getVersion)());
    commander_1.program
        .command("install")
        .description("Install tslab to Jupyter")
        .option("--python [python]", "Which python to install tslab kernel", defaultPy)
        .option("--binary [binary]", "The command to start tslab", defaultBinary)
        .option("--user", "Install to the per-user kernels registry. Default if not root")
        .option("--sys-prefix", "Install to sys.prefix (e.g. a virtualenv or conda env)")
        .option("--prefix [prefix]", "Kernelspec will be installed in {PREFIX}/share/jupyter/kernels/")
        .allowExcessArguments(false)
        .action((options) => {
        let { binary, python, user, sysPrefix, prefix } = options;
        const args = [path_1.default.join(path_1.default.dirname(__dirname), "python", "install.py")];
        args.push(`--tslab=${binary}`);
        if (user) {
            args.push("--user");
        }
        if (sysPrefix) {
            args.push("--sys-prefix");
        }
        if (prefix) {
            args.push(`--prefix=${prefix}`);
        }
        const cmdStr = `${python} ${args.join(" ")}`;
        console.log("Running", cmdStr);
        const ret = child_process_1.default.spawnSync(python, args, {
            stdio: "inherit",
        });
        if (ret.error) {
            console.error("Failed to spawn:", cmdStr);
            process.exit(1);
        }
        process.exit(ret.status);
    });
    commander_1.program
        .command("kernel")
        .description("Start Jupyter kernel. Used from Jupyter internally")
        .option("--config-path <path>", "Path of config file")
        .option("--js", "If set, start JavaScript kernel. Otherwise, TypeScript.")
        .allowExcessArguments(false)
        .action((options) => {
        let { configPath, js: jsKernel } = options;
        startKernel({ configPath, jsKernel, globalVersion: (0, util_1.getVersion)() });
    });
    commander_1.program.parse(process.argv);
}
exports.main = main;
