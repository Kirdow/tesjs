"use strict";
// Copyright (c) 2020-2022 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
Object.defineProperty(exports, "__esModule", { value: true });
exports.printObject = exports.objectShallowEquals = void 0;
const objectShallowEquals = (obj1, obj2) => {
    let isEq = Object.entries(obj1).every(([key, value]) => {
        if (!(key in obj2) || value !== obj2[key]) {
            return false;
        }
        return true;
    });
    if (isEq) {
        isEq = Object.entries(obj2).every(([key, value]) => {
            if (!(key in obj1) || obj1[key] !== value) {
                return false;
            }
            return true;
        });
    }
    return isEq;
};
exports.objectShallowEquals = objectShallowEquals;
const printObject = (obj) => {
    return JSON.stringify(obj);
};
exports.printObject = printObject;
exports.default = {
    objectShallowEquals: exports.objectShallowEquals,
    printObject: exports.printObject
};
