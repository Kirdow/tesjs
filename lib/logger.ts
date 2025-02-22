// Copyright (c) 2020-2022 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

type LevelType = 'debug' | 'error' | 'warn' | 'info' | 'none'

const levels: Record<LevelType, number> = {
    debug: 0,
    error: 1,
    warn: 2,
    info: 3,
    none: 4,
};

let level: LevelType = "warn";

const createLevel = (lvl: LevelType) => {
    return (message: string): void => {
        if (levels[lvl] >= levels[level]) {
            console.log(`${new Date().toUTCString()} - TESjs - ${message}`);
        }
    };
};

export const Logger = {
    setLevel: (lvl: LevelType): void => {
        level = lvl
    },
    debug: createLevel('debug'),
    error: createLevel('error'),
    warn: createLevel('warn'),
    log: createLevel('info')
}

export default Logger
