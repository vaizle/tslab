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
Object.defineProperty(exports, "__esModule", { value: true });
exports.display = exports.newDisplay = exports.versions = void 0;
const crypto_1 = require("crypto");
const jupyter = __importStar(require("./jupyter"));
const util_1 = require("./util");
const ts = __importStar(require("@tslab/typescript-for-tslab"));
/** The version strings of tslab and its dependencies. */
exports.versions = {
    tslab: (0, util_1.getVersion)(),
    typescript: ts.version,
    node: process.version,
};
/**
 * Returns a new `Display` instance which displays and overwrites a single display-entry.
 */
function newDisplay() {
    return new DisplayImpl(newDisplayId());
}
exports.newDisplay = newDisplay;
function newDisplayId() {
    return (0, crypto_1.randomBytes)(8).toString("hex");
}
class DisplayImpl {
    constructor(id) {
        this.id = id;
    }
    javascript(s) {
        this.raw("text/javascript", s);
    }
    html(s) {
        this.raw("text/html", s);
    }
    markdown(s) {
        this.raw("text/markdown", s);
    }
    latex(s) {
        this.raw("text/latex", s);
    }
    svg(s) {
        this.raw("image/svg+xml", s);
    }
    png(b) {
        this.raw("image/png", b);
    }
    jpeg(b) {
        this.raw("image/jpeg", b);
    }
    gif(b) {
        this.raw("image/gif", b);
    }
    pdf(b) {
        this.raw("application/pdf", b);
    }
    text(s) {
        this.raw("text/plain", s);
    }
    raw(contentType, b) {
        if (jupyter.lastWriteDisplayData == null) {
            throw Error("Not ready");
        }
        // TODO: Add a reference of this spec.
        // TODO: Test this.
        if (b instanceof Uint8Array) {
            if (!(b instanceof Buffer)) {
                b = Buffer.from(b);
            }
            b = b.toString("base64");
        }
        const update = this.update;
        if (this.id) {
            this.update = true;
        }
        jupyter.lastWriteDisplayData({
            data: {
                [contentType]: b,
            },
            metadata: {},
            transient: {
                display_id: this.id,
            },
        }, update);
    }
}
/**
 * Utility functions to display rich contents in tslab.
 */
exports.display = new DisplayImpl();
