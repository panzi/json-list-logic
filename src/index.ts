export interface Operations {
    [name: string]: (...args: any[]) => any;
}

export type JsonListLogic =
    null |
    number |
    string |
    boolean |
    {[key: string]: JsonListLogic} |
    [string, ...JsonListLogic[]];

export interface Scope {
    [name: string]: any
}

const KEYWORDS = new Set<string>([
    'fn', 'var', 'if', 'and', 'or', '??', 'partial',
    'Infinity', 'NaN', 'null', 'true', 'false',
]);

const BUILTINS: Operations = Object.assign(Object.create(null), {
    string: (...args: any[]) => args.join(''),

    array: (...args: any[]) => args,

    object(...args: any[]) {
        const obj: {[key: string]: any} = {};
        for (const [key, value] of args) {
            obj[key] = value;
        }
        return obj;
    },

    get(obj: any, prop: any, defaultValue: any = null) {
        let path: any[];
        if (typeof prop === 'string') {
            path = prop.split('.');
        } else if (Array.isArray(prop)) {
            path = prop;
        } else {
            path = [prop];
        }

        for (const key of path) {
            if (!obj) {
                return defaultValue;
            }
            obj = obj[key];
        }

        return obj ?? defaultValue;
    },

    '+': (...args: any[]) => {
        let value = 0;
        for (const arg of args) {
            value += +arg;
        }
        return value;
    },

    '-': (...args: any[]) => {
        if (args.length === 1) {
            return -args[0];
        }
        return args[0] - args[1];
    },

    '*': (...args: any[]) => {
        let value = 1;
        for (const arg of args) {
            value *= arg;
        }
        return value;
    },

    '/': (a: any, b: any) => a / b,
    '%': (a: any, b: any) => a % b,

    '|': (...args: any[]) => {
        let value = 0;
        for (const arg of args) {
            value |= arg;
        }
        return value;
    },

    '&': (...args: any[]) => {
        if (args.length === 0) {
            throw new TypeError('& needs at least one argument');
        }
        let value = args[0];
        for (let index = 1; index < args.length; ++ index) {
            value &= args[index];
        }
        return value;
    },

    '^':  (a: any, b: any) => a ^ b,
    '~':  (arg: any) => ~arg,
    '!':  (arg: any) => !isTruthy(arg),
    '!!': (arg: any) => isTruthy(arg),

    '<': (...args: any[]) => {
        if (args.length < 2) {
            throw new TypeError('< needs at least 2 arguments');
        }
        let a = args[0];
        for (let index = 1; index < args.length; ++ index) {
            const b = args[index];
            if (!(a < b)) {
                return false;
            }
            a = b;
        }
        return true;
    },

    '>': (...args: any[]) => {
        if (args.length < 2) {
            throw new TypeError('> needs at least 2 arguments');
        }
        let a = args[0];
        for (let index = 1; index < args.length; ++ index) {
            const b = args[index];
            if (!(a > b)) {
                return false;
            }
            a = b;
        }
        return true;
    },

    '<=': (...args: any[]) => {
        if (args.length < 2) {
            throw new TypeError('<= needs at least 2 arguments');
        }
        let a = args[0];
        for (let index = 1; index < args.length; ++ index) {
            const b = args[index];
            if (!(a <= b)) {
                return false;
            }
            a = b;
        }
        return true;
    },

    '>=': (...args: any[]) => {
        if (args.length < 2) {
            throw new TypeError('>= needs at least 2 arguments');
        }
        let a = args[0];
        for (let index = 1; index < args.length; ++ index) {
            const b = args[index];
            if (!(a >= b)) {
                return false;
            }
            a = b;
        }
        return true;
    },

    '==':  (a: any, b: any) => a ==  b,
    '===': (a: any, b: any) => a === b,
    '!=':  (a: any, b: any) => a !=  b,
    '!==': (a: any, b: any) => a !== b,

    valueOf: (arg: any) => arg?.valueOf(),
    toString: (arg: any) => String(arg),
    id: (arg: any) => arg,

    print(...args: any[]) {
        console.log(...args);
        return args[0];
    },

    // object
    keys: Object.keys,
    items(obj: any) {
        const items: [string, any][] = [];
        for (const key in obj) {
            items.push([key, obj[key]]);
        }
        return items;
    },
    values: Object.values ?? ((obj: any) => {
        const values: string[] = [];
        for (const key in obj) {
            values.push(obj[key]);
        }
        return values;
    }),
    isEmpty(obj: any) {
        for (const _ in obj) {
            return false;
        }
        return true;
    },

    hasOwnProperty: Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty),

    // string
    substr: (str: any, start: any, length: any) => String(str).substr(start, length),
    parseJSON: JSON.parse,
    stringify: JSON.stringify,

    // array+string
    includes: (items: any, item: any) => items?.includes(item) ?? false,
    slice: (items: any, start: any, end: any) => items?.slice(start, end),
    length: (items: any) => items?.length ?? 0,
    head: (items: any) => items?.[0],
    tail: (items: any) => items?.slice(1),

    // arrays
    every: (items: any[], func: any) => items?.every(item => isTruthy(func(item))) ?? false,
    some: (items: any[], func: any) => items?.some(item => isTruthy(func(item))) ?? false,
    none: (items: any[], func: any) => !items?.some(item => isTruthy(func(item))) ?? false,

    join: (items: any[], delim: any) => items?.join(delim),
    concat: (...args: any[]) => [].concat(...args),
    flatten: (items: any[]) => [].concat(...items),

    map: (items: any[], func: any) => items?.map(func) ?? [],
    reduce: (items: any[], func: any, init?: any) => items?.reduce(func, init ?? null),
    filter: (items: any[], func: any) => items?.filter(item => isTruthy(func(item))),

    // should that be allowed? it's an easy way to cause high CPU, I think
    range(start: any, end?: any, stride?: any) {
        if (end == undefined) {
            end = start;
            start = 0;
        }
        const values: number[] = [];
        if (!stride) {
            stride = 1;
        }
        if (stride < 0) {
            for (let value = start; value > end; value += stride) {
                values.push(value);
            }
        } else {
            for (let value = start; value < end; value += stride) {
                values.push(value);
            }
        }
        return values;
    },

    zip(...lists: readonly any[][]): any[][] {
        const zipped: any[][] = [];
        const listCount = lists.length;

        if (listCount > 0) {
            let itemCount = Infinity;
            for (const list of lists) {
                if (list.length < itemCount) {
                    itemCount = list.length;
                }
            }

            for (let listIndex = 0; listIndex < itemCount; ++ listIndex) {
                const item = new Array(listCount);
                for (let tupleIndex = 0; tupleIndex < listCount; ++ tupleIndex) {
                    item[tupleIndex] = lists[tupleIndex][listIndex];
                }
                zipped.push(item);
            }
        }

        return zipped;
    },

    combinations(...lists: readonly any[][]): any[][] {
        const combinations: any[][] = [];
        const listCount = lists.length;
        const stack: number[] = new Array(listCount);
        const item: any[] = new Array(listCount);
        let stackPtr = 0;

        stack[0] = 0;
        while (stackPtr >= 0) {
            if (stackPtr === listCount) {
                combinations.push([...item]);
                -- stackPtr;
            } else {
                const list  = lists[stackPtr];
                const index = stack[stackPtr];

                if (index === list.length) {
                    -- stackPtr;
                } else {
                    item[stackPtr] = list[index];
                    stack[stackPtr] = index + 1;
                    ++ stackPtr;
                    stack[stackPtr] = 0;
                }
            }
        }

        return combinations;
    },

    // types
    'typeof': (arg: any) => typeof arg,
    isArray: Array.isArray,

    // dates
    now: Date.now,
    parseDate: Date.parse,

    // numbers
    isFinite:   isFinite,
    isNaN:      isNaN,
    parseInt:   parseInt,
    parseFloat: parseFloat,

    EPSILON: () => Number.EPSILON,

    E:       () => Math.E,
    LN10:    () => Math.LN10,
    LN2:     () => Math.LN2,
    LOG2E:   () => Math.LOG2E,
    LOG10E:  () => Math.LOG10E,
    PI:      () => Math.PI,
    SQRT1_2: () => Math.SQRT1_2,
    SQRT2:   () => Math.SQRT2,

    abs:   Math.abs,
    acos:  Math.acos,
    asin:  Math.asin,
    atan:  Math.atan,
    atan2: Math.atan2,
    ceil:  Math.ceil,
    cos:   Math.cos,
    exp:   Math.exp,
    floor: Math.floor,
    log:   Math.log,
    pow:   Math.pow,
    round: Math.round,
    sin:   Math.sin,
    sqrt:  Math.sqrt,
    tan:   Math.tan,
});

export function isTruthy(value: any): boolean {
    return Array.isArray(value) ? value.length !== 0 : !!value;
}

export function isValidName(name: string): boolean {
    return /^[a-zA-Z][_a-zA-Z0-9]*/.test(name) && !KEYWORDS.has(name);
}

export interface Options {
    operations?: Operations;
    allowTuringComplete?: boolean;
}

export function execLogic(code: JsonListLogic, input?: Scope|null, options?: Options): any {
    const allowTuringComplete = options?.allowTuringComplete ?? false;
    let operations: Operations;
    if (options?.operations) {
        for (const name in options.operations) {
            if (!isValidName(name)) {
                throw new Error(`not a valid operation name: ${JSON.stringify(name)}`);
            }
        }
        operations = Object.assign(Object.create(null), BUILTINS, options.operations);
    } else {
        operations = BUILTINS;
    }

    function execIntern(code: JsonListLogic, scope: Scope): any {
        if (Array.isArray(code)) {
            const op = code[0];
            switch (op) {
                case 'fn':
                {
                    let body: JsonListLogic;

                    switch (code.length) {
                        case 0:
                        case 1:
                            body = null;
                            break;

                        case 2:
                            body = code[1];
                            break;

                        case 3:
                        {
                            const arg1 = code[1];
                            const argNames = Array.isArray(arg1) ? arg1.map(String) : [String(arg1)];
                            body = code[2];

                            if (argNames.length > 0) {
                                for (const argName of argNames) {
                                    if (!isValidName(argName)) {
                                        throw new SyntaxError(`illegal argument name: ${argName}`);
                                    }
                                }

                                return (...args: any[]) => {
                                    const nestedScope: Scope = Object.create(scope);
                                    for (let index = 0; index < args.length;) {
                                        const value = args[index];
                                        nestedScope[argNames[index]] = value;
                                        nestedScope[++ index] = value;
                                    }
                                    return execIntern(body, nestedScope);
                                };
                            } else {
                                return (...args: any[]) => {
                                    const nestedScope: Scope = Object.create(scope);
                                    for (let index = 0; index < args.length;) {
                                        const value = args[index];
                                        nestedScope[++ index] = value;
                                    }
                                    return execIntern(body, nestedScope);
                                };
                            }
                        }
                        default:
                            throw new SyntaxError(`fn needs 0 to 2 arguments: ${JSON.stringify(code)}`);
                    }

                    return (...args: any[]) => {
                        const nestedScope: Scope = Object.create(scope);
                        for (let index = 0; index < args.length;) {
                            const value = args[index];
                            nestedScope[++ index] = value;
                        }
                        return execIntern(body, nestedScope);
                    };
                }
                case 'var':
                {
                    let path: any[];
                    switch (code.length) {
                        case 0:
                        case 1:
                            throw new SyntaxError(`var needs at least one argument: ${JSON.stringify(code)}`);

                        case 2:
                            path = String(code[1]).split('.');

                        default:
                            path = code.slice(1);
                            break;
                    }

                    let obj = scope;
                    for (const key of path) {
                        if (!obj) {
                            return null;
                        }
                        obj = obj[key];
                    }

                    return obj ?? null;
                }
                case 'if':
                    if (code.length < 3) {
                        throw new SyntaxError(`if needs at least 3 arguments: ${JSON.stringify(code)}`);
                    }

                    for (let index = 1; index < code.length; ++ index) {
                        if (isTruthy(execIntern(code[index ++], scope))) {
                            return execIntern(code[index], scope);
                        }
                        ++ index;
                        if (index + 1 >= code.length) {
                            return execIntern(code[index], scope);
                        }
                    }
                    return null;

                case 'or':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`or needs at least one argument: ${JSON.stringify(code)}`);
                    }
                    const lastIndex = code.length - 1;
                    for (let index = 1; index < lastIndex; ++ index) {
                        const value = execIntern(code[index], scope);
                        if (isTruthy(value)) {
                            return value;
                        }
                    }
                    return execIntern(code[lastIndex], scope);
                }
                case '??':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`?? needs at least one argument: ${JSON.stringify(code)}`);
                    }
                    const lastIndex = code.length - 1;
                    for (let index = 1; index < lastIndex; ++ index) {
                        const value = execIntern(code[index], scope);
                        if (value != null) {
                            return value;
                        }
                    }
                    return execIntern(code[lastIndex], scope);
                }
                case 'and':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`and needs at least one argument: ${JSON.stringify(code)}`);
                    }
                    const lastIndex = code.length - 1;
                    for (let index = 1; index < lastIndex; ++ index) {
                        const value = execIntern(code[index], scope);
                        if (!isTruthy(value)) {
                            return value;
                        }
                    }
                    return execIntern(code[lastIndex], scope);
                }
                case 'partial':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`partial needs at least one argument: ${JSON.stringify(code)}`);
                    }

                    let func: Function;
                    let arg1 = code[1];
                    if (Array.isArray(arg1) && allowTuringComplete) {
                        // This makes it turing complete, because you can build a Y combinator with this.
                        arg1 = execIntern(arg1, scope);
                    }

                    if (typeof arg1 === 'function') {
                        func = arg1;
                    } else {
                        if (typeof arg1 !== 'string') {
                            throw new ReferenceError(`illegal first argument to partial: ${JSON.stringify(code)}`);
                        }

                        if (arg1 in operations) {
                            func = operations[arg1];
                        } else {
                            throw new ReferenceError(`function is not defined: ${JSON.stringify(arg1)}`);
                        }
                    }

                    if (code.length > 2) {
                        const boundArgs: any[] = [];
                        for (let index = 2; index < code.length; ++ index) {
                            boundArgs.push(execIntern(code[index], scope));
                        }
                        return (...args: any[]) => func(...boundArgs, ...args);
                    }
                    return func;
                }
                default:
                    const args: any[] = new Array(code.length - 1);
                    for (let index = 1; index < code.length; ++ index) {
                        args[index - 1] = execIntern(code[index], scope);
                    }

                    let func: Function;
                    if (typeof op === 'function') {
                        if (!allowTuringComplete) {
                            throw new SyntaxError(`illegal operation: ${JSON.stringify(code)}`);
                        }
                        func = op;
                    } else if (Array.isArray(op)) {
                        if (!allowTuringComplete) {
                            throw new SyntaxError(`illegal operation: ${JSON.stringify(code)}`);
                        }
                        const value = execIntern(op, scope);
                        if (typeof value !== 'function') {
                            throw new TypeError(`illegal operation: ${JSON.stringify(code)}, not a function: ${JSON.stringify(value)}`);
                        }
                        func = value;
                    } else {
                        if (op in operations) {
                            func = operations[op];
                        } else {
                            throw new ReferenceError(`function is not defined: ${JSON.stringify(op)}`);
                        }
                    }

                    return func(...args);
            }
        } else if (code && typeof code === 'object') {
            const obj: {[name: string]: any} = {};
            for (const key in code) {
                obj[key] = execIntern(code[key], scope);
            }
            return obj;
        } else {
            return code ?? null;
        }
    }

    return execIntern(code, input ?? Object.create(null));
}

export class JsonListLogicError extends Error {
    constructor(message: string) {
        super(message);

        this.name = this.constructor.name;
        if ('captureStackTrace' in Error) {
            Error.captureStackTrace(this);
        }
    }
}

export class JsonListLogicSyntaxError extends JsonListLogicError {
    readonly index:  number;
    readonly lineno: number;
    readonly column: number;

    constructor(index: number, code: string, message: string, contextLines: number = 2) {
        const slice = code.slice(0, index);
        const lineStart = slice.lastIndexOf('\n') + 1;
        let lineno = 1;
        for (let index = 0;; ++ index) {
            index = slice.indexOf('\n', index);
            if (index === -1) {
                break;
            }
            ++ lineno;
        }
        const column = slice.length - lineStart;

        const linenoStr = String(lineno);
        let lineEnd = lineStart - 1;
        const buf: string[] = ['\n'];
        const context: string[] = [];
        for (let contextLine = 0; lineEnd > 0 && contextLine < contextLines; ++ contextLine) {
            const lineStart = code.slice(0, lineEnd).lastIndexOf('\n') + 1;
            context.push(` ${String(lineno - contextLine - 1).padStart(linenoStr.length)} | ${code.slice(lineStart, lineEnd)}\n`);
            lineEnd = lineStart - 1;
        }
        context.reverse();
        buf.push(...context);
        lineEnd = code.indexOf('\n', index);
        if (lineEnd === -1) {
            lineEnd = code.length;
        }
        buf.push(' ', linenoStr, ' | ', code.slice(lineStart, lineEnd), '\n');
        const indent = ''.padStart(linenoStr.length + 4);
        buf.push(indent);
        for (let index = 0; index < column; ++ index) {
            buf.push('-');
        }
        buf.push('^\n');
        buf.push(indent, message);

        super(buf.join(''));

        this.index  = index;
        this.lineno = lineno;
        this.column = column;
    }
}

const ESC_MAP: {[ch: string]: string} = {
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
    '"':  '"',
    '\\': '\\',
    '/':  '/',
};

type ParseState =
    ['val', unknown] |
    [']', unknown[]] |
    [')', unknown[]] |
    ['fn', ['id'|'val', any][]] |
    ['}', {[key: string]: unknown}] |
    [':', {[key: string]: unknown}, string] |
    [':val', {[key: string]: unknown}, string];

export function parseLogic(code: string): JsonListLogic {
    const regex = /(\s+)|(\/\*)|(\/\/[^\n]*(?:\n|$))|"((?:[^"\\]|\\[bfnrt"\/\\]|\\u[0-9a-fA-F]{4})*)"|([-+]?[0-9]+(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?)|(\b[a-zA-Z][_a-zA-Z0-9]*\b)|([-+]Infinity\b)|([-+<>=!?*\/%!|&~]+)|\$([0-9]+\b)|([(){}:\[\]])/g;
    const stack: ParseState[] = [];
    let index = 0;

    function pushVal(value: unknown): void {
        if (stack.length > 0) {
            const top = stack[stack.length - 1];
            switch (top[0]) {
                case ']':
                case ')':
                    top[1].push(value);
                    break;

                case '}':
                    if (value && typeof value === 'object') {
                        throw new JsonListLogicSyntaxError(index, code, 'unexpected object');
                    }
                    stack[stack.length - 1] = [':', top[1], String(value)];
                    break;

                case ':val':
                    const obj = top[1];
                    obj[top[2]] = value;
                    stack[stack.length - 1] = ['}', obj];
                    break;

                case 'fn':
                    const args = top[1];
                    if (args.length > 0 && args[args.length - 1][0] !== 'id') {
                        throw new JsonListLogicSyntaxError(index, code, 'unexpected token');
                    }
                    args.push(['val', value]);
                    break;

                default:
                    throw new JsonListLogicSyntaxError(index, code, `illegal parse state: ${top[0]}`);
            }
        } else {
            stack.push(['val', value]);
        }
    }

    while (regex.lastIndex < code.length) {
        index = regex.lastIndex;
        const match = regex.exec(code);
        if (!match) {
            throw new JsonListLogicSyntaxError(index, code, 'unexpected character');
        }

        if (match[1] !== undefined) {
            // skip whitespace
        } else if (match[2] !== undefined) {
            const endIndex = code.indexOf('*/', index);
            if (endIndex < 0) {
                throw new JsonListLogicSyntaxError(index, code, 'unterminated multiline comment');
            }

            regex.lastIndex = endIndex + 2;
        } else if (match[3] !== undefined) {
            // skip comment
        } else if (match[4] !== undefined) {
            // string
            const string = match[4].replace(/\\(?:([bfnrt"\/\\])|u([0-9a-fA-F]{4}))/g, (_, esc, uni) =>
                uni ? String.fromCharCode(parseInt(uni, 16)) : ESC_MAP[esc]
            );
            pushVal(string);
        } else if (match[5] !== undefined) {
            // number
            pushVal(+match[5]);
        } else if (match[6] !== undefined) {
            // identifier
            const ident = match[6];
            switch (ident) {
                case 'Infinity':
                    pushVal(Infinity);
                    break;

                case 'NaN':
                    pushVal(NaN);
                    break;

                case 'null':
                    pushVal(null);
                    break;

                case 'true':
                    pushVal(true);
                    break;

                case 'false':
                    pushVal(false);
                    break;

                default:
                    if (stack.length === 0) {
                        pushVal(['var', ident]);
                    }
                    const top = stack[stack.length - 1];
                    if (top[0] === ')') {
                        const args = top[1];
                        if (args.length === 0 && ident === 'fn') {
                            stack[stack.length - 1] = ['fn', []];
                        } else if (args[0] === 'var' || (args.length === 1 && args[0] === 'partial')) {
                            args.push(ident);
                        } else if (args.length > 0) {
                            args.push(['var', ident]);
                        } else {
                            args.push(ident);
                        }
                    } else if (top[0] === 'fn') {
                        const args = top[1];
                        if (args.length > 0 && args[args.length - 1][0] !== 'id') {
                            throw new JsonListLogicSyntaxError(index, code, 'unexpected token');
                        }
                        args.push(['id', ident]);
                    } else if (top[0] === ']') {
                        top[1].push(['var', ident]);
                    } else if (top[0] === '}') {
                        pushVal(ident);
                    } else {
                        throw new JsonListLogicSyntaxError(index, code, 'unexpected identifier');
                    }
                }
        } else if (match[7] !== undefined) {
            pushVal(match[7] === '-Infinity' ? -Infinity : Infinity);
        } else if (match[8] !== undefined) {
            // operation
            const op = match[8];
            if (stack.length === 0) {
                throw new JsonListLogicSyntaxError(index, code, 'unexpected operation');
            }
            const top = stack[stack.length - 1];
            if (top[0] === ')') {
                const array = top[1];
                if (array.length === 1 && array[0] === 'partial') {
                    array.push(op);
                } else if (array.length > 0) {
                    throw new JsonListLogicSyntaxError(index, code, 'unexpected operation');
                } else {
                    array.push(op);
                }
            } else {
                throw new JsonListLogicSyntaxError(index, code, 'unexpected operation');
            }
        } else if (match[9] !== undefined) {
            pushVal(['var', parseInt(match[9])]);
        } else if (match[10] !== undefined) {
            const special = match[10];
            switch (special) {
                case '[':
                    stack.push([']', ['array']]);
                    break;

                case '(':
                    stack.push([')', []]);
                    break;

                case '{':
                    stack.push(['}', {}]);
                    break;

                case ':':
                {
                    if (stack.length === 0) {
                        throw new JsonListLogicSyntaxError(index, code, `unexpected token`);
                    }
                    const top = stack[stack.length - 1];
                    if (top[0] !== ':') {
                        throw new JsonListLogicSyntaxError(index, code, `unexpected token`);
                    }
                    stack[stack.length - 1] = [':val', top[1], top[2]];
                    break;
                }
                case ']':
                {
                    if (stack.length === 0) {
                        throw new JsonListLogicSyntaxError(index, code, 'unexpected token');
                    }
                    const top = stack[stack.length - 1];
                    if (top[0] !== ']') {
                        throw new JsonListLogicSyntaxError(index, code, 'unexpected token');
                    }
                    stack.pop();
                    pushVal(top[1]);
                    break;
                }
                case ')':
                {
                    if (stack.length === 0) {
                        throw new JsonListLogicSyntaxError(index, code, 'unexpected token');
                    }
                    const top = stack[stack.length - 1];
                    if (top[0] === 'fn') {
                        const args = top[1];
                        const [kind, body] = args.pop() ?? ['val', null];

                        stack.pop();
                        pushVal(['fn', args.map(item => item[1]), kind === 'id' ? ['var', body] : body]);
                    } else if (top[0] !== ')') {
                        throw new JsonListLogicSyntaxError(index, code, 'unexpected token');
                    } else {
                        const args = top[1];
                        if (args.length === 0) {
                            throw new JsonListLogicSyntaxError(index, code, 'expected function name or operation');
                        }
                        stack.pop();
                        pushVal(args);
                    }
                    break;
                }
                case '}':
                {
                    if (stack.length === 0) {
                        throw new JsonListLogicSyntaxError(index, code, 'unexpected token');
                    }
                    const top = stack[stack.length - 1];
                    if (top[0] !== '}') {
                        throw new JsonListLogicSyntaxError(index, code, 'unexpected token');
                    }
                    stack.pop();
                    pushVal(top[1]);
                    break;
                }
                default:
                    throw new JsonListLogicSyntaxError(index, code, 'unexpected token');
            }
        }
    }

    if (stack.length === 0) {
        throw new JsonListLogicSyntaxError(regex.lastIndex, code, 'unexpected end of file');
    }

    if (stack.length > 1 || stack[0][0] !== 'val') {
        throw new JsonListLogicSyntaxError(regex.lastIndex, code, `unexpected end of file, expected ${stack[stack.length - 1][0]}`);
    }

    return stack[0][1] as JsonListLogic;
}

export function formatLogic(code: JsonListLogic, indent?: number|string|null): string {
    // TODO: indent
    const indentStr = typeof indent === 'string' ? indent : ''.padStart(indent ?? 0);
    const buffer: string[] = [];

    function formatIntern(code: JsonListLogic, indent: string): void {
        if (Array.isArray(code)) {
            switch (code[0]) {
                case 'array':
                    buffer.push('[');
                    for (let index = 1; index < code.length; ++ index) {
                        formatIntern(code[index], indent);
                        if (index + 1 < code.length) {
                            buffer.push(' ');
                        }
                    }
                    buffer.push(']');
                    break;

                case 'var':
                {
                    const arg1 = code[1];
                    if (code.length === 2 && typeof arg1 === 'number' && arg1 > 0 && (arg1|0) === arg1) {
                        buffer.push('$', String(arg1));
                    } else {
                        buffer.push('(var');
                        for (let index = 1; index < code.length; ++ index) {
                            buffer.push(' ');
                            const item = code[index];
                            if (typeof item === 'string' && isValidName(item)) {
                                buffer.push(item)
                            } else {
                                formatIntern(item, indent);
                            }
                        }
                        buffer.push(')');
                    }
                    break;
                }
                case 'fn':
                {
                    const arg1 = code[0];
                    buffer.push('(fn');
                    switch (code.length) {
                        case 0:
                        case 1:
                            break;

                        case 2:
                            buffer.push(' ');
                            formatIntern(code[1], indent);
                            break;

                        default:
                            for (const argName of code[1] as string[]) {
                                buffer.push(' ', argName);
                            }
                            buffer.push(' ');
                            formatIntern(code[2], indent);
                            break;
                    }
                    buffer.push(')');
                    break;
                }
                default:
                {
                    const arg1 = code[0];
                    buffer.push('(');
                    if (typeof arg1 === 'string') {
                        buffer.push(arg1);
                    } else {
                        formatIntern(arg1, indent);
                    }
                    for (let index = 1; index < code.length; ++ index) {
                        buffer.push(' ');
                        formatIntern(code[index], indent);
                    }
                    buffer.push(')');
                    break;
                }
            }
        } else if (code == null) {
            buffer.push('null');
        } else {
            switch (typeof code) {
                case 'object':
                    buffer.push('{');
                    let first = true;
                    for (const key in code) {
                        if (first) {
                            first = false;
                        } else {
                            buffer.push(' ');
                        }
                        const value = code[key];
                        if (isValidName(key)) {
                            buffer.push(key);
                        } else {
                            buffer.push(JSON.stringify(key));
                        }
                        buffer.push(': ');
                        formatIntern(value, indent);
                    }
                    buffer.push('}');
                    break;

                case 'string':
                case 'number':
                case 'boolean':
                    buffer.push(JSON.stringify(code));
                    break;

                default:
                    throw new TypeError(`illegal JsonListLogic type: ${typeof code}`);
            }
        }
    }

    formatIntern(code, '');

    return buffer.join('');
}
