export declare let VERSION: string;
export declare const CACHE_DIR: string;
export declare const REGISTRY = "https://registry.npmjs.org";
export declare const PKG_NAME = "@lionad/safe-npx";
export declare const DEFAULT_TIME_HOURS = 24;
export declare const DEFAULT_FALLBACK_STRATEGY = "patch,minor,major";
export declare const MS_PER_HOUR: number;
export declare const isTty: boolean;
export declare const colors: {
    bold: (s: string) => string;
    dim: (s: string) => string;
    green: (s: string) => string;
    cyan: (s: string) => string;
    yellow: (s: string) => string;
};
export declare const HELP_TEXT: string;
export declare const NPX_PREFIX_FLAGS: Set<string>;
export declare const NPX_PREFIX_FLAGS_WITH_VALUE: Set<string>;
