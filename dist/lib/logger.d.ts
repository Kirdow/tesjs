type LevelType = 'debug' | 'error' | 'warn' | 'info' | 'none';
export declare const Logger: {
    setLevel: (lvl: LevelType) => void;
    debug: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
    log: (message: string) => void;
};
export default Logger;
