"use strict";
// Copyright (c) 2020-2022 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const levels = {
    debug: 0,
    error: 1,
    warn: 2,
    info: 3,
    none: 4,
};
let level = "error";
const createLevel = (lvl) => {
    return (message) => {
        if (levels[lvl] >= levels[level]) {
            console.log(`${new Date().toUTCString()} - TESjs - ${message}`);
        }
    };
};
exports.Logger = {
    setLevel: (lvl) => {
        level = lvl;
    },
    debug: createLevel('debug'),
    error: createLevel('error'),
    warn: createLevel('warn'),
    log: createLevel('info')
};
exports.default = exports.Logger;
