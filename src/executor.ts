import { JsonListLogic } from "./logic";
import { isValidName, toDate, isTruthy, toString, parseDate } from "./utils";

export interface Operations {
    [name: string]: (...args: any[]) => any;
}

export interface Scope {
    [name: string]: any
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

const SAFE_FNARGS: {[fn: string]: boolean[]} = Object.assign(Object.create(null), {
    id:       [true],
    toString: [true],
    isArray:  [true],
    'typeof': [true],
    every:    [false, true],
    some:     [false, true],
    none:     [false, true],
    map:      [false, true],
    reduce:   [false, true, false],
    filter:   [false, true],
});

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
        return args[args.length - 1] ?? null;
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

export interface Options {
    operations?: Operations;
    allowTuringComplete?: boolean;
}

export function execLogic(code: JsonListLogic, input?: Scope|null, options?: Options): any {
    const allowTuringComplete = !!options?.allowTuringComplete;
    let operations: Operations;
    const safeFnargs: {[fn: string]: boolean[]} = allowTuringComplete ?
        null : Object.assign(Object.create(null), SAFE_FNARGS);
    if (options?.operations) {
        for (const name in options.operations) {
            if (!isValidName(name)) {
                throw new Error(`not a valid operation name: ${JSON.stringify(name)}`);
            }
            if (!allowTuringComplete) {
                delete safeFnargs[name];
            }
        }
        operations = Object.assign(Object.create(null), BUILTINS, options.operations);
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
                    if (obj && path.length > 0) {
                        // 1st element is from scope which uses prototype chain,
                        // and has a Object.create(null) at the root, and thus we
                        // don't want to use hasOwnProperty() on the first element.
                        obj = obj[path[0]];

                        for (let index = 1; index < path.length; ++ index) {
                            const key = path[index];
                            if (!hasOwnProperty.call(obj, key)) {
                                return null;
                            }
                            obj = obj[key];
                        }
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
                    switch (code.length) {
                        case 3:
                        {
                            const vars = execIntern(code[1], scope, fnargs);
                            if (!vars || typeof vars !== 'object') {
                                throw new TypeError(`1st argument to 2 argument let needs to be an object: ${JSON.stringify(code)}`);
                            }
                            // deliberately not allow fallback-access to parent scope here
                            // if you want that you need to explicitly name your variables
                            const newScope =
                                Object.getPrototypeOf(vars) === null ? vars :
                                Object.assign(Object.create(null), vars);
                            return execIntern(code[2], newScope, fnargs);
                        }
                        case 4:
                            const newScope = Object.create(scope);
                            let letInstr = code;
                            for (;;) {
                                const varName = letInstr[1];
                                if (typeof varName !== 'string') {
                                    throw new SyntaxError(`1st argument to 3 argument let needs to be a string: ${JSON.stringify(letInstr)}`);
                                }
                                newScope[varName] = execIntern(letInstr[2], newScope, fnargs);
                                const childInstr = letInstr[3];
                                if (Array.isArray(childInstr) && childInstr.length === 4 && childInstr[0] === 'let') {
                                    letInstr = childInstr;
                                } else {
                                    break;
                                }
                            }
                            return execIntern(letInstr[3], newScope, fnargs);

                        default:
                            throw new SyntaxError(`let needs 2 to 3 arguments: ${JSON.stringify(code)}`);
                    }
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
                        if (!allowTuringComplete) {
                            throw new TypeError(`illegal instruction when allowTuringComplete=false: ${JSON.stringify(code)}`);
                        }
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

                    let func: Function;
                    if (typeof op === 'function') {
                        if (!allowTuringComplete) {
                            // maybe this is fine?
                            throw new TypeError(`illegal instruction when allowTuringComplete=false: ${JSON.stringify(code)}`);
                        }
                        func = op;
                        for (let index = 1; index < code.length; ++ index) {
                            args[index - 1] = execIntern(code[index], scope, fnargs);
                        }
                    } else if (Array.isArray(op)) {
                        if (!allowTuringComplete) {
                            throw new TypeError(`illegal instruction when allowTuringComplete=false: ${JSON.stringify(code)}`);
                        }
                        const value = execIntern(op, scope, fnargs);
                        if (typeof value !== 'function') {
                            throw new TypeError(`illegal operation: ${JSON.stringify(code)}, not a function: ${JSON.stringify(value)}`);
                        }
                        func = value;
                        for (let index = 1; index < code.length; ++ index) {
                            args[index - 1] = execIntern(code[index], scope, fnargs);
                        }
                    } else {
                        if (op in operations) {
                            func = operations[op];
                            for (let index = 1; index < code.length; ++ index) {
                                const argind = index - 1;
                                const arg = args[argind] = execIntern(code[index], scope, fnargs);
                                if (safeFnargs && !safeFnargs[op]?.[argind] && typeof arg === 'function') {
                                    throw new TypeError(`argument ${index} is of illegal type 'function' when allowTuringComplete=false: ${JSON.stringify(code)}`);
                                }
                            }
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
