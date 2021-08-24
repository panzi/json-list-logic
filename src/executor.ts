import { JsonListLogic } from "./logic";
import { isValidName, isTruthy, hasOwnProperty } from "./utils";
import { Operations, _SAFE_FNARGS, _BUILTINS } from "./operations";

export interface Scope {
    [name: string]: any
}

export interface Options {
    operations?: Operations;
    allowTuringComplete?: boolean;
}

export function execLogic(code: JsonListLogic, input?: Scope|null, options?: Options): any {
    const allowTuringComplete = !!options?.allowTuringComplete;
    let operations: Operations;
    const safeFnargs: {[fn: string]: boolean[]} = allowTuringComplete ?
        null : Object.assign(Object.create(null), _SAFE_FNARGS);
    if (options?.operations) {
        for (const name in options.operations) {
            if (!isValidName(name)) {
                throw new Error(`not a valid operation name: ${JSON.stringify(name)}`);
            }
            if (!allowTuringComplete) {
                delete safeFnargs[name];
            }
        }
        operations = Object.assign(Object.create(null), _BUILTINS, options.operations);
    } else {
        operations = _BUILTINS;
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

                    for (let index = 1; index < code.length;) {
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
                        {
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
                        }
                        default:
                            throw new SyntaxError(`let needs 2 to 3 arguments: ${JSON.stringify(code)}`);
                    }
                }
                case 'partial':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`partial needs at least one argument: ${JSON.stringify(code)}`);
                    }

                    let arg1: JsonListLogic|Function = code[1];
                    if (Array.isArray(arg1)) {
                        // This makes it turing complete, because you can build a Y combinator with this.
                        if (!allowTuringComplete) {
                            throw new TypeError(`illegal instruction when allowTuringComplete=false: ${JSON.stringify(code)}`);
                        }
                        arg1 = execIntern(arg1, scope, fnargs);
                    }

                    if (typeof arg1 === 'function') {
                        const func = arg1;
                        if (code.length > 2) {
                            const boundArgs: any[] = [];
                            for (let index = 2; index < code.length; ++ index) {
                                const arg = execIntern(code[index], scope, fnargs);
                                if (!allowTuringComplete && typeof arg === 'function') {
                                    throw new TypeError(`argument ${index - 1} is of illegal type 'function' when allowTuringComplete=false: ${JSON.stringify(code)}`);
                                }
                                boundArgs.push(arg);
                            }
                            return (...args: any[]) => func(...boundArgs, ...args);
                        }
                        return func;
                    } else if (typeof arg1 !== 'string') {
                        throw new SyntaxError(`illegal first argument to partial: ${JSON.stringify(code)}`);
                    } else if (arg1 in operations) {
                        const func = operations[arg1];

                        if (code.length > 2) {
                            const boundArgs: any[] = [];
                            for (let index = 2; index < code.length; ++ index) {
                                const arg = execIntern(code[index], scope, fnargs);
                                const argind = index - 2;
                                if (safeFnargs && !safeFnargs[op]?.[argind] && typeof arg === 'function') {
                                    throw new TypeError(`argument ${index - 1} is of illegal type 'function' when allowTuringComplete=false: ${JSON.stringify(code)}`);
                                }
                                boundArgs.push(arg);
                            }
                            return (...args: any[]) => func(...boundArgs, ...args);
                        }
                        return func;
                    } else {
                        throw new ReferenceError(`function is not defined: ${JSON.stringify(arg1)}`);
                    }

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
                    } else if (op in operations) {
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
