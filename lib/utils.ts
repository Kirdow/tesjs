// Copyright (c) 2020-2022 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export const objectShallowEquals = (obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean => {
    let isEq = Object.entries(obj1).every(([key, value]) => {
        if (!(key in obj2) || value !== obj2[key]) {
            return false
        }

        return true
    })

    if (isEq) {
        isEq = Object.entries(obj2).every(([key, value]) => {
            if (!(key in obj1) || obj1[key] !== value) {
                return false
            }

            return true
        })
    }

    return isEq
}

export const printObject = (obj: Record<string, unknown>): string => {
    return JSON.stringify(obj)
}

export default {
    objectShallowEquals,
    printObject
}
