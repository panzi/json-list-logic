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
    'fn', 'var', 'arg', 'let', 'if', 'and', 'or', '??', 'partial',
    'Infinity', 'NaN', 'null', 'true', 'false',
]);

const hasOwnProperty = Object.prototype.hasOwnProperty;

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
            if (!hasOwnProperty.call(obj, key)) {
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

    '<<': (a: any, b: any) => a << b,
    '>>': (a: any, b: any) => a >> b,

    '^':  (a: any, b: any) => a ^ b,
    '~':  (arg: any) => ~arg,
    '!':  (arg: any) => !isTruthy(arg),
    '!!': isTruthy,

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

    '==':  (a: any, b: any) => a === b,
    '!=':  (a: any, b: any) => a !== b,

    toString: toString,
    id: (arg: any) => arg,

    print(...args: any[]) {
        console.log(...args);
        return args[0];
    },

    // object
    keys: Object.keys,

    items(obj: any) {
        const items: [string|number, any][] = [];
        if (Array.isArray(obj)) {
            for (let index = 0; index < obj.length; ++ index) {
                items.push([index, obj[index]]);
            }
        } else if (obj) {
            for (const key in obj) {
                items.push([key, obj[key]]);
            }
        }
        return items;
    },

    values: Object.values ?? ((obj: any) => {
        if (Array.isArray(obj)) {
            return obj;
        }
        const values: string[] = [];
        for (const key in obj) {
            values.push(obj[key]);
        }
        return values;
    }),

    isEmpty(obj: any) {
        if (Array.isArray(obj)) {
            return obj.length === 0;
        }
        for (const _ in obj) {
            return false;
        }
        return true;
    },

    has: (obj: any, prop: string) =>
        obj == null ? false :
        Object.prototype.hasOwnProperty.call(obj, prop),

    mergeObjects: (...objs: any[]) => Object.assign({}, ...objs),

    // string
    substr: (str: any, start: number, length: number) => String(str).substr(start, length),
    parseJSON: JSON.parse,
    stringify: JSON.stringify,

    // array+string
    'in': (item: any, items: any[]|string|null) =>
        items == null ? false :
        Array.isArray(items) ? items.includes(item) :
        String(items).includes(item),

    slice: (items: any[]|string, start: number, end: number) =>
        items == null ? null :
        Array.isArray(items) ? items.slice(start, end) :
        String(items).slice(start, end),

    length(items: any): number {
        if (items == null) {
            return 0;
        }

        if (Array.isArray(items)) {
            return items.length;
        }

        switch (typeof items) {
            case 'string':
                return items.length;

            case 'object':
                let count = 0;
                for (const _ in items) {
                    ++ count;
                }
                return count;

            default:
                return 0;
        }
    },

    head: (items: any[]|string) => items?.[0] ?? null,
    tail: (items: any[]|string) =>
        items == null ? null :
        Array.isArray(items) ? items.slice(1) :
        toString(items).slice(1),

    // arrays
    every: (items: any[], func: any) => Array.isArray(items) ?  items.every(item => isTruthy(func(item))) : true,
    some:  (items: any[], func: any) => Array.isArray(items) ?  items.some( item => isTruthy(func(item))) : false,
    none:  (items: any[], func: any) => Array.isArray(items) ? !items.some( item => isTruthy(func(item))) : true,

    join: (items: any[], delim: any) =>
        items == null ? '' :
        Array.isArray(items) ? items.map(toString).join(delim) :
        typeof items == 'object' ? Object.keys(items).join(delim) :
        String(items),

    concat: (...args: any[]) => [].concat(...args),
    flatten: (items: any[]) => Array.isArray(items) ? [].concat(...items) : items,

    map(items: any, func: (arg: any) => any): any[] {
        if (!items) {
            return [];
        }

        if (Array.isArray(items)) {
            return items.map(func);
        }

        if (typeof items === 'string') {
            return Array.prototype.map.call(items, func);
        }

        const output = [];
        for (const key in items) {
            output.push(func([key, items[key]]));
        }
        return output;
    },

    reduce(items: any, func: (prev: any, current: any) => any, init?: any) {
        if (!items) {
            return init ?? null;
        }

        if (Array.isArray(items)) {
            return items.reduce(func, init ?? null);
        }

        if (typeof items === 'string') {
            return Array.prototype.reduce.call(items, func, init ?? null);
        }

        let result = init ?? null;
        for (const key in items) {
            result = func(result, [key, items[key]]);
        }
        return result;
    },

    filter(items: any, func: (item: any) => boolean) {
        if (!items) {
            return [];
        }

        if (Array.isArray(items)) {
            return items.filter(func);
        }

        if (typeof items === 'string') {
            return Array.prototype.filter.call(items, func);
        }

        const output: {[key: string]: any} = {};
        for (const key in items) {
            const value = items[key];
            if (func([key, items[key]])) {
                output[key] = value;
            }
        }
        return output;
    },

    toArray(items: any): any[] {
        if (!items) {
            return [];
        }

        if (Array.isArray(items)) {
            return items;
        }

        const array: [string, any][] = [];
        for (const key in items) {
            array.push([key, items[key]]);
        }
        return array;
    },

    // should that be allowed? it's an easy way to cause high CPU, I think
    range(start: number, end?: number|null, stride?: number|null): number[] {
        if (end == undefined) {
            end = start|0;
            start = 0;
        } else {
            // integer cast
            start |= 0;
            end   |= 0;
        }
        const values: number[] = [];
        if (!stride) {
            stride = 1;
        } else {
            // integer cast
            stride |= 0;
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
                if (!Array.isArray(list)) {
                    return [];
                }
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
        if (!lists.every(Array.isArray)) {
            return [];
        }
        const combinations: any[][] = [];
        const listCount = lists.length;
        const stack = new Uint32Array(listCount);
        const item: any[] = new Array(listCount);
        let stackPtr = 0;

        stack[0] = 0;
        while (stackPtr >= 0) {
            if (stackPtr === listCount) {
                combinations.push(item.slice());
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
    timestamp(value: any): number {
        if (value instanceof Date) {
            return value.getTime();
        }

        switch (typeof value) {
            case 'string':
                return parseDate(value).getTime();

            case 'number':
                return value;

            default:
                throw new TypeError(`illegal value for timestamp: ${JSON.stringify(value)}`);
        }
    },

    formatDateTime(timestamp: any) {
        const date = toDate(timestamp);
        return date.toISOString();
    },

    formatDate(timestamp: any) {
        const date = toDate(timestamp);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    yearOf(timestamp: any) {
        const date = toDate(timestamp);
        return date.getFullYear();
    },

    monthOf(timestamp: any) {
        const date = toDate(timestamp);
        return date.getMonth() + 1;
    },

    dateOf(timestamp: any) {
        const date = toDate(timestamp);
        return date.getDate();
    },

    hoursOf(timestamp: any) {
        const date = toDate(timestamp);
        return date.getHours();
    },

    minutesOf(timestamp: any) {
        const date = toDate(timestamp);
        return date.getMinutes();
    },

    secondsOf(timestamp: any) {
        const date = toDate(timestamp);
        return date.getSeconds();
    },

    timeSince(value: any) {
        if (value instanceof Date) {
            return Date.now() - value.getTime();
        }

        if (typeof value === 'string') {
            return Date.now() - parseDate(value).getTime();
        }
        return Date.now() - +value;
    },

    seconds: (count: number) => +count * 1000,
    minutes: (count: number) => +count * 60 * 1000,
    hours:   (count: number) => +count * 60 * 60 * 1000,
    days:    (count: number) => +count * 24 * 60 * 60 * 1000,

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

function toString(value: any): string {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/*
    /^([0-9]+)-([0-9]{1,2})-([0-9]{1,2})
    (?:[T ]
        ([0-9]{1,2})
        (?:
            :
            ([0-9]{1,2})
            (?:
                :
                ([0-9]{1,2}(?:\.[0-9]{3})?)?
                (Z|([-+])([0-9]{2}):([0-9]{2}))
            )?
        )?
    )?$/
*/
const DATETIME_PATTERN = /^([0-9]+)-([0-9]{1,2})-([0-9]{1,2})(?:[T ]([0-9]{1,2})(?::([0-9]{1,2})(?::([0-9]{1,2})((?:\.[0-9]{3})?)?(Z|([-+])([0-9]{2}):([0-9]{2})))?)?)?$/;

// only accept ISO date-times
function parseDate(value: string): Date {
    if (typeof value !== 'string') {
        throw new TypeError(`illegal argument type passed to parseDate(): ${typeof value}`);
    }

    if (!DATETIME_PATTERN.test(value)) {
        throw new TypeError(`illegal date-time string: ${JSON.stringify(value)}`);
    }

    return new Date(value);
}

function toDate(value: any): Date {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'string') {
        return parseDate(value);
    }

    const date = new Date();
    date.setTime(value);

    return date;
}

export function isTruthy(value: any): boolean {
    if (!value) {
        return false;
    }

    if (Array.isArray(value)) {
        return value.length !== 0;
    }

    if (typeof value === 'object') {
        for (const _ in value) {
            return true;
        }
        return false;
    }

    return !!value;
}

export function isValidName(name: string): boolean {
    return /^[a-zA-Z][_a-zA-Z0-9]*/.test(name) && !KEYWORDS.has(name);
}

export function execLogic(code: JsonListLogic, input?: Scope|null, customOperations?: Operations): any {
    let operations: Operations;
    if (customOperations) {
        for (const name in customOperations) {
            if (!isValidName(name)) {
                throw new Error(`not a valid operation name: ${JSON.stringify(name)}`);
            }
        }
        operations = Object.assign(Object.create(null), BUILTINS, customOperations);
    } else {
        operations = BUILTINS;
    }

    function execIntern(code: JsonListLogic, scope: Scope, fnargs: any[]): any {
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
                            const argNames = Array.isArray(arg1) ? arg1 : [arg1];
                            body = code[2];

                            if (argNames.length > 0) {
                                for (const argName of argNames) {
                                    if (typeof argName !== 'string' || !isValidName(argName)) {
                                        throw new SyntaxError(`illegal argument name: ${JSON.stringify(argName)}`);
                                    }
                                }

                                return function (this: any, ...args: any[]) {
                                    const nestedScope: Scope = Object.create(scope);
                                    for (let index = 0; index < args.length; ++ index) {
                                        nestedScope[argNames[index] as string] = args[index];
                                    }
                                    args.unshift(this);
                                    return execIntern(body, nestedScope, args);
                                };
                            } else {
                                return function (this: any, ...args: any[]) {
                                    args.unshift(this);
                                    return execIntern(body, scope, args);
                                };
                            }
                        }
                        default:
                            throw new SyntaxError(`fn needs 0 to 2 arguments: ${JSON.stringify(code)}`);
                    }

                    return function (this: any, ...args: any[]) {
                        args.unshift(this);
                        return execIntern(body, scope, args);
                    };
                }
                case 'var':
                {
                    let path: any[];
                    switch (code.length) {
                        case 0:
                        case 1:
                            throw new SyntaxError(`var needs at least one argument: ${JSON.stringify(code)}`);

                        default:
                            path = code.slice(1);
                            break;
                    }

                    let obj = scope;
                    for (const key of path) {
                        if (!hasOwnProperty.call(obj, key)) {
                            return null;
                        }
                        obj = obj[key];
                    }

                    return obj ?? null;
                }
                case 'arg':
                {
                    let path: any[];
                    switch (code.length) {
                        case 0:
                        case 1:
                            throw new SyntaxError(`arg needs at least one argument: ${JSON.stringify(code)}`);

                        default:
                            path = code.slice(1);
                            break;
                    }

                    let obj = fnargs;
                    for (const key of path) {
                        if (!hasOwnProperty.call(obj, key)) {
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
                        if (isTruthy(execIntern(code[index ++], scope, fnargs))) {
                            return execIntern(code[index], scope, fnargs);
                        }
                        ++ index;
                        if (index + 1 >= code.length) {
                            return execIntern(code[index], scope, fnargs);
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
                        const value = execIntern(code[index], scope, fnargs);
                        if (isTruthy(value)) {
                            return value;
                        }
                    }
                    return execIntern(code[lastIndex], scope, fnargs);
                }
                case '??':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`?? needs at least one argument: ${JSON.stringify(code)}`);
                    }
                    const lastIndex = code.length - 1;
                    for (let index = 1; index < lastIndex; ++ index) {
                        const value = execIntern(code[index], scope, fnargs);
                        if (value != null) {
                            return value;
                        }
                    }
                    return execIntern(code[lastIndex], scope, fnargs);
                }
                case 'and':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`and needs at least one argument: ${JSON.stringify(code)}`);
                    }
                    const lastIndex = code.length - 1;
                    for (let index = 1; index < lastIndex; ++ index) {
                        const value = execIntern(code[index], scope, fnargs);
                        if (!isTruthy(value)) {
                            return value;
                        }
                    }
                    return execIntern(code[lastIndex], scope, fnargs);
                }
                case 'let':
                {
                    if (code.length !== 3) {
                        throw new SyntaxError(`let needs at exactly 2 arguments: ${JSON.stringify(code)}`);
                    }
                    const vars = execIntern(code[1], scope, fnargs);
                    if (!vars || typeof vars !== 'object') {
                        throw new TypeError(`1st argument to let needs to be an object: ${JSON.stringify(code)}`);
                    }
                    const newScope = Object.assign(Object.create(scope), vars);
                    return execIntern(code[2], newScope, fnargs);
                }
                case 'partial':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`partial needs at least one argument: ${JSON.stringify(code)}`);
                    }

                    let func: Function;
                    let arg1 = code[1];
                    if (Array.isArray(arg1)) {
                        // This makes it turing complete, because you can build a Y combinator with this.
                        arg1 = execIntern(arg1, scope, fnargs);
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
                            boundArgs.push(execIntern(code[index], scope, fnargs));
                        }
                        return (...args: any[]) => func(...boundArgs, ...args);
                    }
                    return func;
                }
                default:
                    const args: any[] = new Array(code.length - 1);
                    for (let index = 1; index < code.length; ++ index) {
                        args[index - 1] = execIntern(code[index], scope, fnargs);
                    }

                    let func: Function;
                    if (typeof op === 'function') {
                        func = op;
                    } else if (Array.isArray(op)) {
                        const value = execIntern(op, scope, fnargs);
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
                obj[key] = execIntern(code[key], scope, fnargs);
            }
            return obj;
        } else {
            return code ?? null;
        }
    }

    const scope = input ?? Object.create(null);
    return execIntern(code, scope, [null, scope]);
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
    const regex = /(\s+)|(;[^\n]*(?:\n|$))|"((?:[^"\\]|\\[bfnrt"\/\\]|\\u[0-9a-fA-F]{4})*)"|([-+]?[0-9]+(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?)|(\b[a-zA-Z][_a-zA-Z0-9]*\b)|([-+]Infinity\b)|([-+<>=!?*\/%|&~^]+)|\$([0-9]+\b)|([(){}:\[\]])/g;
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
                        throw new JsonListLogicSyntaxError(index, code, 'Unexpected object');
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
                        throw new JsonListLogicSyntaxError(index, code, 'Unexpected token');
                    }
                    args.push(['val', value]);
                    break;

                default:
                    throw new JsonListLogicSyntaxError(index, code, `Illegal parse state: ${top[0]}`);
            }
        } else {
            stack.push(['val', value]);
        }
    }

    while (regex.lastIndex < code.length) {
        index = regex.lastIndex;
        const match = regex.exec(code);
        if (!match) {
            throw new JsonListLogicSyntaxError(index, code, 'Unexpected character');
        }

        if (match[1] !== undefined) {
            // skip whitespace
        } else if (match[2] !== undefined) {
            // skip comment
        } else if (match[3] !== undefined) {
            // string
            const string = match[3].replace(/\\(?:([bfnrt"\/\\])|u([0-9a-fA-F]{4}))/g, (_, esc, uni) =>
                uni ? String.fromCharCode(parseInt(uni, 16)) : ESC_MAP[esc]
            );
            pushVal(string);
        } else if (match[4] !== undefined) {
            // number
            pushVal(+match[4]);
        } else if (match[5] !== undefined) {
            // identifier
            const ident = match[5];
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
                        } else if (args[0] === 'var' || args[0] === 'arg' || (args.length === 1 && args[0] === 'partial')) {
                            args.push(ident);
                        } else if (args.length > 0) {
                            args.push(['var', ident]);
                        } else {
                            args.push(ident);
                        }
                    } else if (top[0] === 'fn') {
                        const args = top[1];
                        if (args.length > 0 && args[args.length - 1][0] !== 'id') {
                            throw new JsonListLogicSyntaxError(index, code, 'Unexpected token');
                        }
                        args.push(['id', ident]);
                    } else if (top[0] === ']') {
                        top[1].push(['var', ident]);
                    } else if (top[0] === '}') {
                        pushVal(ident);
                    } else {
                        throw new JsonListLogicSyntaxError(index, code, 'Unexpected identifier');
                    }
                }
        } else if (match[6] !== undefined) {
            pushVal(match[6] === '-Infinity' ? -Infinity : Infinity);
        } else if (match[7] !== undefined) {
            // operation
            const op = match[7];
            if (stack.length === 0) {
                throw new JsonListLogicSyntaxError(index, code, 'Unexpected operation');
            }
            const top = stack[stack.length - 1];
            if (top[0] === ')') {
                const array = top[1];
                if (array.length === 1 && array[0] === 'partial') {
                    array.push(op);
                } else if (array.length > 0) {
                    throw new JsonListLogicSyntaxError(index, code, 'Unexpected operation');
                } else {
                    array.push(op);
                }
            } else {
                throw new JsonListLogicSyntaxError(index, code, 'Unexpected operation');
            }
        } else if (match[8] !== undefined) {
            pushVal(['arg', parseInt(match[8])]);
        } else if (match[9] !== undefined) {
            const special = match[9];
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
                        throw new JsonListLogicSyntaxError(index, code, `Unexpected token`);
                    }
                    const top = stack[stack.length - 1];
                    if (top[0] !== ':') {
                        throw new JsonListLogicSyntaxError(index, code, `Unexpected token`);
                    }
                    stack[stack.length - 1] = [':val', top[1], top[2]];
                    break;
                }
                case ']':
                {
                    if (stack.length === 0) {
                        throw new JsonListLogicSyntaxError(index, code, 'Unexpected token');
                    }
                    const top = stack[stack.length - 1];
                    if (top[0] !== ']') {
                        throw new JsonListLogicSyntaxError(index, code, 'Unexpected token');
                    }
                    stack.pop();
                    pushVal(top[1]);
                    break;
                }
                case ')':
                {
                    if (stack.length === 0) {
                        throw new JsonListLogicSyntaxError(index, code, 'Unexpected token');
                    }
                    const top = stack[stack.length - 1];
                    if (top[0] === 'fn') {
                        const args = top[1];
                        const [kind, body] = args.pop() ?? ['val', null];

                        stack.pop();
                        pushVal(['fn', args.map(item => item[1]), kind === 'id' ? ['var', body] : body]);
                    } else if (top[0] !== ')') {
                        throw new JsonListLogicSyntaxError(index, code, 'Unexpected token');
                    } else {
                        const args = top[1];
                        if (args.length === 0) {
                            throw new JsonListLogicSyntaxError(index, code, 'Expected function name or operation');
                        }
                        stack.pop();
                        pushVal(args);
                    }
                    break;
                }
                case '}':
                {
                    if (stack.length === 0) {
                        throw new JsonListLogicSyntaxError(index, code, 'Unexpected token');
                    }
                    const top = stack[stack.length - 1];
                    if (top[0] !== '}') {
                        throw new JsonListLogicSyntaxError(index, code, 'Unexpected token');
                    }
                    stack.pop();
                    pushVal(top[1]);
                    break;
                }
                default:
                    throw new JsonListLogicSyntaxError(index, code, 'Unexpected token');
            }
        } else {
            throw new JsonListLogicSyntaxError(index, code, 'Internal parser error. This is a bug.');
        }
    }

    if (stack.length === 0) {
        throw new JsonListLogicSyntaxError(regex.lastIndex, code, 'Unexpected end of file');
    }

    if (stack.length > 1 || stack[0][0] !== 'val') {
        throw new JsonListLogicSyntaxError(regex.lastIndex, code, `Unexpected end of file, expected ${stack[stack.length - 1][0]}`);
    }

    return stack[0][1] as JsonListLogic;
}

export function formatLogic(code: JsonListLogic, indent?: number|null, maxLineLength: number = 80): string {
    const tokens: string[] = [];

    function emitToken(str: string): void {
        tokens.push(str);
    }

    function emitTokens(code: JsonListLogic): void {
        if (Array.isArray(code)) {
            switch (code[0]) {
                case 'array':
                {
                    emitToken('[');
                    for (let index = 1; index < code.length; ++ index) {
                        emitTokens(code[index]);
                    }
                    emitToken(']');
                    break;
                }
                case 'var':
                {
                    const arg1 = code[1];
                    if (code.length === 2 && typeof arg1 === 'string' && isValidName(arg1)) {
                        emitToken(arg1);
                    } else {
                        emitToken('(');
                        emitToken('var');
                        for (let index = 1; index < code.length; ++ index) {
                            const item = code[index];
                            if (typeof item === 'string' && isValidName(item)) {
                                emitToken(item);
                            } else {
                                emitTokens(item);
                            }
                        }
                        emitToken(')');
                    }
                    break;
                }
                case 'arg':
                {
                    const arg1 = code[1];
                    if (code.length === 2 && typeof arg1 === 'number' && arg1 >= 0 && (arg1|0) === arg1) {
                        emitToken(`$${arg1}`);
                    } else {
                        emitToken('(');
                        emitToken('arg');
                        for (let index = 1; index < code.length; ++ index) {
                            const item = code[index];
                            if (typeof item === 'string' && isValidName(item)) {
                                emitToken(item);
                            } else {
                                emitTokens(item);
                            }
                        }
                        emitToken(')');
                    }
                    break;
                }
                case 'fn':
                {
                    emitToken('(');
                    emitToken('fn');
                    switch (code.length) {
                        case 0:
                        case 1:
                            break;

                        case 2:
                            emitTokens(code[1]);
                            break;

                        default:
                            for (const argName of code[1] as string[]) {
                                emitToken(argName);
                            }
                            emitTokens(code[2]);
                            break;
                    }
                    emitToken(')');
                    break;
                }
                default:
                {
                    emitToken('(');
                    const arg1 = code[0];
                    if (typeof arg1 === 'string') {
                        emitToken(arg1);
                    } else {
                        emitTokens(arg1);
                    }
                    for (let index = 1; index < code.length; ++ index) {
                        emitTokens(code[index]);
                    }
                    emitToken(')');
                    break;
                }
            }
        } else if (code == null) {
            emitToken('null');
        } else {
            switch (typeof code) {
                case 'object':
                    emitToken('{');
                    for (const key in code) {
                        const value = code[key];
                        if (isValidName(key)) {
                            emitToken(key);
                        } else {
                            emitToken(JSON.stringify(key));
                        }
                        emitToken(':');
                        emitTokens(value);
                    }
                    emitToken('}');
                    break;

                case 'string':
                    emitToken(JSON.stringify(code));
                    break;

                case 'number':
                case 'boolean':
                    emitToken(String(code));
                    break;

                default:
                    throw new TypeError(`illegal JsonListLogic type: ${typeof code}`);
            }
        }
    }

    emitTokens(code);

    if (!indent || indent < 0) {
        indent = 0;
    }

    const buffer: string[] = [];
    let indentStack: number[] = [0];
    let prevToken = '';

    for (let index = 0; index < tokens.length; ++ index) {
        const token = tokens[index];
        let currentIndent = indentStack[indentStack.length - 1];

        switch (token) {
            case '(':
            case '[':
            case '{':
                if (currentIndent === 0) {
                    if (prevToken !== '' && prevToken !== '(' && prevToken !== '[' && prevToken !== '{') {
                        buffer.push(' ');
                    }
                } else if (prevToken !== '' && prevToken !== '(') {
                    buffer.push('\n', ''.padStart(currentIndent));
                }
                buffer.push(token);

                if (currentIndent + unwrappedLength(tokens, index) > maxLineLength) {
                    currentIndent += indent;
                    indentStack.push(currentIndent);
                } else {
                    indentStack.push(0);
                }
                break;

            case ')':
            case ']':
            case '}':
                const oldIndent = currentIndent;
                indentStack.pop();
                currentIndent = indentStack[indentStack.length - 1];
                if (oldIndent > 0) {
                    buffer.push('\n', ''.padStart(currentIndent));
                }
                buffer.push(token);
                break;

            default:
                if (currentIndent === 0) {
                    if (prevToken !== '' && prevToken !== '(' && prevToken !== '[' && prevToken !== '{') {
                        buffer.push(' ');
                    }
                } else if (prevToken !== '' && prevToken !== '(') {
                    buffer.push('\n', ''.padStart(currentIndent));
                }
                buffer.push(token);
                break;
        }

        prevToken = token;
    }

    return buffer.join('');
}

function unwrappedLength(tokens: string[], index: number) {
    const token = tokens[index];

    switch (token) {
        case '(':
        case '[':
        case '{':
            break;

        case undefined:
            return 0;

        default:
            return token.length;
    }

    let length  = 1;
    let nesting = 1;
    let wasOpen = true;
    for (++ index; nesting > 0 && index < tokens.length; ++ index) {
        const token = tokens[index];
        switch (token) {
            case ')':
            case ']':
            case '}':
                ++ length;
                -- nesting;
                wasOpen = false;
                break;

            case '(':
            case '[':
            case '{':
                if (!wasOpen) {
                    ++ length;
                }
                ++ length;
                ++ nesting;
                wasOpen = true;
                break;

            default:
                if (!wasOpen) {
                    ++ length;
                }
                length += token.length;
                wasOpen = false;
                break;
        }
    }

    return length;
}
