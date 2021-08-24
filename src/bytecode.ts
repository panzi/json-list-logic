import { isTruthy, isValidName, toString, hasOwnProperty } from "./utils";
import { JsonListLogic, Scope } from "./logic";
import { Operations, _SAFE_FNARGS, _BUILTINS } from "./operations";

export enum Instruction {
    Push,
    Pop,

    ToNumber,
    ToString,
    ToBool, // isTruthy

    Add,
    NumNegate,
    Sub,
    Mul,
    Div,
    Mod,
    BitAnd,
    BitOr,
    XOr,
    BitNegate,
    ShiftLeft,
    ShiftRight,
    BoolNegate,

    Lt,
    Gt,
    Lte,
    Gte,
    Eq,
    Neq,

    SetVar,
    GetVar,
    GetArg,
    GetItem,

    // Jump location is in the code after jump instruction.
    Jmp,
    // Conditional jumps only pop the value when NOT jumping.
    JmpIfTrue,
    JmpIfFalse,
    JmpIfNull,
    JmpIfNotNull,

    AssertNotFunction,

    DeriveScope,
    NewScope,
    PopScope,

    Closure,
    Partial,
    Call,
    Return,

    NewArray,
    ArrayPush,
    NewObject,
    SetProp,
}

export type ByteCode = (
    Instruction | string | number | boolean | null | Function | (string | number)[]
)[];

export interface Options {
    operations?: Operations;
    allowTuringComplete?: boolean;
}

export interface CompiledLogic {
    operations: Operations;
    code: ByteCode;
}

export function compileLogic(logic: JsonListLogic, options?: Options): CompiledLogic {
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
    const code: ByteCode = [];
    const fns: {
        refs: number[],
        args: string[],
        body: JsonListLogic,
    }[] = [];

    function compileIntern(logic: JsonListLogic): void {
        if (Array.isArray(logic)) {
            const op = logic[0];
            switch (op) {
                case '+':
                    if (logic.length === 2) {
                        compileIntern(logic[1]);
                        code.push(Instruction.ToNumber);
                    } else if (logic.length > 2) {
                        compileIntern(logic[1]);
                        for (let index = 2; index < logic.length; ++ index) {
                            compileIntern(logic[index]);
                            code.push(Instruction.Add);
                        }
                    }
                    break;

                case '-':
                    if (logic.length === 2) {
                        compileIntern(logic[1]);
                        code.push(Instruction.NumNegate);
                    } else if (logic.length === 3) {
                        compileIntern(logic[1]);
                        compileIntern(logic[2]);
                        code.push(Instruction.Sub);
                    } else {
                        throw new SyntaxError(`operation - may only have 1 or 2 arguments: ${JSON.stringify(logic)}`);
                    }
                    break;

                case '*':
                    if (logic.length === 1) {
                        code.push(Instruction.Push, 1);
                    } else {
                        compileIntern(logic[1]);
                        for (let index = 2; index < logic.length; ++ index) {
                            compileIntern(logic[index]);
                            code.push(Instruction.Mul);
                        }
                    }
                    break;

                case '/':
                    if (logic.length !== 3) {
                        throw new SyntaxError(`operation / requires exactly 2 arguments: ${JSON.stringify(logic)}`);
                    }
                    compileIntern(logic[1]);
                    compileIntern(logic[2]);
                    code.push(Instruction.Div);
                    break;

                case '%':
                    if (logic.length !== 3) {
                        throw new SyntaxError(`operation % requires exactly 2 arguments: ${JSON.stringify(logic)}`);
                    }
                    compileIntern(logic[1]);
                    compileIntern(logic[2]);
                    code.push(Instruction.Mod);
                    break;

                case '~':
                    if (logic.length !== 2) {
                        throw new SyntaxError(`operation ~ requires exactly 1 argument: ${JSON.stringify(logic)}`);
                    }
                    compileIntern(logic[1]);
                    code.push(Instruction.BitNegate);
                    break;

                case '^':
                    if (logic.length !== 3) {
                        throw new SyntaxError(`operation ^ requires exactly 2 arguments: ${JSON.stringify(logic)}`);
                    }
                    compileIntern(logic[1]);
                    compileIntern(logic[2]);
                    code.push(Instruction.XOr);
                    break;

                case '|':
                    if (logic.length !== 3) {
                        throw new SyntaxError(`operation | requires exactly 2 arguments: ${JSON.stringify(logic)}`);
                    }
                    compileIntern(logic[1]);
                    compileIntern(logic[2]);
                    code.push(Instruction.BitOr);
                    break;

                case '&':
                    if (logic.length !== 3) {
                        throw new SyntaxError(`operation & requires exactly 2 arguments: ${JSON.stringify(logic)}`);
                    }
                    compileIntern(logic[1]);
                    compileIntern(logic[2]);
                    code.push(Instruction.BitAnd);
                    break;

                case '!':
                    if (logic.length !== 2) {
                        throw new SyntaxError(`operation ! requires exactly 1 argument: ${JSON.stringify(logic)}`);
                    }
                    compileIntern(logic[1]);
                    code.push(Instruction.BoolNegate);
                    break;

                case '!!':
                    if (logic.length !== 2) {
                        throw new SyntaxError(`operation !! requires exactly 1 argument: ${JSON.stringify(logic)}`);
                    }
                    compileIntern(logic[1]);
                    code.push(Instruction.ToBool);
                    break;

                case 'if':
                {
                    if (code.length < 3) {
                        throw new SyntaxError(`if needs at least 3 arguments: ${JSON.stringify(logic)}`);
                    }

                    const refs: number[] = [];
                    for (let index = 1; index < logic.length - 1;) {
                        compileIntern(logic[index ++]);
                        code.push(Instruction.JmpIfFalse);
                        const ref = code.length;
                        code.push(-1);
                        // value is popped when not jumping

                        if (index >= logic.length) {
                            throw new SyntaxError(`if needs at least 3 arguments: ${JSON.stringify(logic)}`);
                        }

                        // true branch
                        compileIntern(logic[index ++]);
                        code.push(Instruction.Jmp);
                        refs.push(code.length);
                        code.push(-1);

                        code[ref] = code.length;
                        // start of else
                        code.push(Instruction.Pop);
                        if (index + 1 >= logic.length) {
                            // last else value
                            if (index >= logic.length) {
                                code.push(Instruction.Push, null);
                            } else {
                                compileIntern(logic[index ++]);
                            }
                            break;
                        }
                    }
                    const location = code.length;
                    for (const ref in refs) {
                        code[ref] = location;
                    }
                    break;
                }
                case 'and':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`and needs at least one argument: ${JSON.stringify(logic)}`);
                    }

                    const refs: number[] = [];
                    for (let index = 1; index < logic.length - 1; ++ index) {
                        compileIntern(logic[index]);
                        code.push(Instruction.JmpIfFalse);
                        refs.push(code.length);
                        code.push(-1);
                    }
                    compileIntern(logic[logic.length - 1]);
                    const location = code.length;
                    for (const ref of refs) {
                        code[ref] = location;
                    }
                    break;
                }
                case 'or':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`or needs at least one argument: ${JSON.stringify(logic)}`);
                    }

                    const refs: number[] = [];
                    for (let index = 1; index < logic.length - 1; ++ index) {
                        compileIntern(logic[index]);
                        code.push(Instruction.JmpIfTrue);
                        refs.push(code.length);
                        code.push(-1);
                    }
                    compileIntern(logic[logic.length - 1]);
                    const location = code.length;
                    for (const ref of refs) {
                        code[ref] = location;
                    }
                    break;
                }
                case '??':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`?? needs at least one argument: ${JSON.stringify(logic)}`);
                    }

                    const refs: number[] = [];
                    for (let index = 1; index < logic.length - 1; ++ index) {
                        compileIntern(logic[index]);
                        code.push(Instruction.JmpIfNotNull);
                        refs.push(code.length);
                        code.push(-1);
                    }
                    compileIntern(logic[logic.length - 1]);
                    const location = code.length;
                    for (const ref of refs) {
                        code[ref] = location;
                    }
                    break;
                }
                case 'var':
                    if (logic.length < 2) {
                        throw new SyntaxError(`var needs at least one argument: ${JSON.stringify(logic)}`);
                    }
                    const arg1 = logic[1];
                    if (typeof arg1 !== 'string' || !isValidName(arg1)) {
                        throw new TypeError(`first argument of var needs to be a name: ${JSON.stringify(logic)}`);
                    }
                    for (let index = 2; index < logic.length; ++ index) {
                        const key = logic[index];
                        switch (typeof key) {
                            case 'number':
                            case 'string':
                                break;

                            default:
                                throw new TypeError(`var has illegal keys: ${JSON.stringify(logic)}`);
                        }
                    }
                    code.push(Instruction.GetVar, arg1);

                    if (logic.length > 2) {
                        const refs: number[] = [];
                        for (let index = 2; index < logic.length - 1; ++ index) {
                            const key = logic[index];
                            code.push(Instruction.Push, key as string|number, Instruction.GetItem);
                            code.push(Instruction.JmpIfNull);
                            refs.push(code.length);
                            code.push(-1);
                        }
                        const key = logic[logic.length - 1];
                        code.push(Instruction.Push, key as string|number, Instruction.GetItem);
                        const location = code.length;
                        for (const ref of refs) {
                            code[ref] = location;
                        }
                    }
                    break;

                case 'arg':
                {
                    if (logic.length < 2) {
                        throw new SyntaxError(`arg needs at least one argument: ${JSON.stringify(logic)}`);
                    }
                    const arg1 = logic[1];
                    if (typeof arg1 !== 'number' || arg1 < 0 || (arg1|0) !== arg1) {
                        throw new TypeError(`first argument of arg needs to be a positive integer: ${JSON.stringify(logic)}`);
                    }
                    for (let index = 2; index < logic.length; ++ index) {
                        const key = logic[index];
                        switch (typeof key) {
                            case 'number':
                            case 'string':
                                break;

                            default:
                                throw new TypeError(`arg has illegal keys: ${JSON.stringify(logic)}`);
                        }
                    }
                    code.push(Instruction.GetArg, arg1);

                    if (logic.length > 2) {
                        const refs: number[] = [];
                        for (let index = 2; index < logic.length - 1; ++ index) {
                            const key = logic[index];
                            code.push(Instruction.Push, key as string|number, Instruction.GetItem);
                            code.push(Instruction.JmpIfNull);
                            refs.push(code.length);
                            code.push(-1);
                        }
                        const key = logic[logic.length - 1];
                        code.push(Instruction.Push, key as string|number, Instruction.GetItem);
                        const location = code.length;
                        for (const ref of refs) {
                            code[ref] = location;
                        }
                    }
                    break;
                }
                case 'get':
                {
                    if (logic.length < 2) {
                        throw new SyntaxError(`get needs at least one argument: ${JSON.stringify(logic)}`);
                    }
                    compileIntern(logic[1]);

                    if (logic.length > 2) {
                        const refs: number[] = [];
                        for (let index = 2; index < logic.length - 1; ++ index) {
                            const key = logic[index];
                            compileIntern(key);
                            code.push(Instruction.GetItem);
                            code.push(Instruction.JmpIfNull);
                            refs.push(code.length);
                            code.push(-1);
                        }
                        const key = logic[logic.length - 1];
                        code.push(Instruction.Push, key as string|number, Instruction.GetItem);
                        const location = code.length;
                        for (const ref of refs) {
                            code[ref] = location;
                        }
                    }
                    break;
                }
                case 'let':
                    switch (logic.length) {
                        case 3:
                            compileIntern(logic[1]);
                            code.push(Instruction.NewScope);
                            compileIntern(logic[2]);
                            code.push(Instruction.PopScope);
                            break;

                        case 4:
                            code.push(Instruction.DeriveScope);
                            let letInstr = logic;
                            let count = 0;
                            for (;;) {
                                ++ count;
                                const varName = letInstr[1];
                                if (typeof varName !== 'string' || !isValidName(varName)) {
                                    throw new SyntaxError(`1st argument to 3 argument let needs to be a string: ${JSON.stringify(letInstr)}`);
                                }
                                compileIntern(letInstr[2]);
                                code.push(Instruction.SetVar, varName);
                                const childInstr = letInstr[3];
                                if (Array.isArray(childInstr) && childInstr.length === 4 && childInstr[0] === 'let') {
                                    letInstr = childInstr;
                                } else {
                                    break;
                                }
                            }
                            compileIntern(letInstr[3]);
                            code.push(Instruction.PopScope);
                            break;

                        default:
                            throw new SyntaxError(`let needs 2 to 3 arguments: ${JSON.stringify(logic)}`);
                    }
                    break;

                case 'fn':
                    code.push(Instruction.Closure);
                    fns.push({
                        refs: [code.length],
                        args: logic.slice(1, logic.length - 1) as string[],
                        body: logic.length > 1 ? logic[logic.length - 1] : null,
                    });
                    code.push(-1);
                    break;

                case 'partial':
                {
                    if (code.length < 2) {
                        throw new SyntaxError(`partial needs at least one argument: ${JSON.stringify(logic)}`);
                    }
                    let arg1 = logic[1];
                    if (Array.isArray(arg1)) {
                        // This makes it turing complete, because you can build a Y combinator with this.
                        if (!allowTuringComplete) {
                            throw new TypeError(`illegal instruction when allowTuringComplete=false: ${JSON.stringify(logic)}`);
                        }
                        compileIntern(arg1);

                        for (let index = 2; index < logic.length; ++ index) {
                            compileIntern(logic[index]);
                            if (!allowTuringComplete) {
                                code.push(Instruction.AssertNotFunction);
                            }
                        }
                        code.push(Instruction.Partial, logic.length - 2);
                    } else if (typeof arg1 !== 'string') {
                        throw new SyntaxError(`illegal first argument to partial: ${JSON.stringify(logic)}`);
                    } else if (arg1 in operations) {
                        code.push(Instruction.Push, arg1);

                        for (let index = 2; index < logic.length; ++ index) {
                            compileIntern(logic[index]);
                            const argind = index - 2;
                            if (safeFnargs && !safeFnargs[op]?.[argind]) {
                                code.push(Instruction.AssertNotFunction);
                            }
                        }
                        code.push(Instruction.Partial, logic.length - 2);
                    } else {
                        throw new ReferenceError(`function is not defined: ${JSON.stringify(arg1)}`);
                    }
                    break;
                }
                default:
                    const argc = logic.length - 1;
                    if (typeof op === 'function') {
                        if (!allowTuringComplete) {
                            // maybe this is fine?
                            throw new TypeError(`illegal instruction when allowTuringComplete=false: ${JSON.stringify(logic)}`);
                        }
                        for (let index = 1; index < logic.length; ++ index) {
                            compileIntern(logic[index]);
                        }
                        code.push(Instruction.Push, op, Instruction.Call, argc);
                    } else if (Array.isArray(op)) {
                        if (!allowTuringComplete) {
                            throw new TypeError(`illegal instruction when allowTuringComplete=false: ${JSON.stringify(logic)}`);
                        }
                        compileIntern(logic[0]);
                        code.push(Instruction.Call, argc);
                    } else if (op in operations) {
                        for (let index = 1; index < logic.length; ++ index) {
                            compileIntern(logic[index]);

                            const argind = index - 1;
                            if (safeFnargs && !safeFnargs[op]?.[argind]) {
                                code.push(Instruction.AssertNotFunction);
                            }
                        }
                        code.push(Instruction.Push, op, Instruction.Call, argc);
                    } else {
                        throw new ReferenceError(`function is not defined: ${JSON.stringify(op)}`);
                    }
                    break;
            }
        } else if (logic && typeof logic === 'object') {
            code.push(Instruction.NewObject);
            for (const key in logic) {
                code.push(Instruction.Push, key);
                compileIntern(logic[key]);
                code.push(Instruction.SetProp);
            }
        } else {
            code.push(Instruction.Push, logic ?? null);
        }
    }

    compileIntern(logic);
    code.push(Instruction.Return);

    for (let index = 0; index < fns.length; ++ index) {
        const fn = fns[index];
        for (const ref of fn.refs) {
            code[ref] = code.length;
        }

        compileIntern(fn.body);
        code.push(Instruction.Return);
    }

    return { code, operations };
}

export function execByteCode(logic: CompiledLogic, input?: Scope|null): any {
    let stackPtr = 1;
    let instrPtr = 0;
    let framePtr = 0;
    let argc = 2;
    const { code, operations } = logic;
    let scope = input ?? Object.create(null);
    const stack: any[] = [null, scope];

    function execIntern(): any {
        for (;;) {
            const op = code[instrPtr ++];
            switch (op as Instruction) {
                case Instruction.Push:
                    stack[++ stackPtr] = code[instrPtr ++];
                    break;

                case Instruction.Pop:
                    stackPtr --;
                    break;

                case Instruction.ToNumber:
                    stack[stackPtr] = +stack[stackPtr];
                    break;

                case Instruction.ToString:
                    stack[stackPtr] = toString(stack[stackPtr]);
                    break;

                case Instruction.ToBool:
                    stack[stackPtr] = isTruthy(stack[stackPtr]);
                    break;

                case Instruction.Add:
                {
                    const value = +stack[stackPtr --];
                    stack[stackPtr] = +stack[stackPtr] + value;
                    break;
                }
                case Instruction.NumNegate:
                    stack[stackPtr] = -stack[stackPtr];
                    break;

                case Instruction.Sub:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] -= value;
                    break;
                }
                case Instruction.Mul:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] *= value;
                    break;
                }
                case Instruction.Div:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] /= value;
                    break;
                }
                case Instruction.Mod:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] %= value;
                    break;
                }
                case Instruction.BitAnd:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] &= value;
                    break;
                }
                case Instruction.BitOr:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] |= value;
                    break;
                }
                case Instruction.XOr:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] ^= value;
                    break;
                }
                case Instruction.BitNegate:
                    stack[stackPtr] = ~stack[stackPtr];
                    break;

                case Instruction.ShiftLeft:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] <<= value;
                    break;
                }
                case Instruction.ShiftRight:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] >>= value;
                    break;
                }
                case Instruction.BoolNegate:
                    stack[stackPtr] = !isTruthy(stack[stackPtr]);
                    break;

                case Instruction.Lt:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] = stack[stackPtr] < value;
                    break;
                }
                case Instruction.Gt:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] = stack[stackPtr] > value;
                    break;
                }
                case Instruction.Lte:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] = stack[stackPtr] <= value;
                    break;
                }
                case Instruction.Gte:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] = stack[stackPtr] >= value;
                    break;
                }
                case Instruction.Eq:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] = stack[stackPtr] === value;
                    break;
                }
                case Instruction.Neq:
                {
                    const value = stack[stackPtr --];
                    stack[stackPtr] = stack[stackPtr] !== value;
                    break;
                }
                case Instruction.SetVar:
                    scope[code[instrPtr ++] as string] = stack[stackPtr --];
                    break;

                case Instruction.GetVar:
                    stack[++ stackPtr] = scope[code[instrPtr ++] as string];
                    break;

                case Instruction.GetArg:
                {
                    const argind = code[instrPtr ++] as number;
                    stack[++ stackPtr] = argind > argc ? null : stack[framePtr + argind];
                    break;
                }
                case Instruction.GetItem:
                {
                    const key = code[instrPtr ++] as string|number;
                    const obj = stack[stackPtr];
                    if (hasOwnProperty.call(obj, key)) {
                        stack[stackPtr] = obj[key];
                    } else {
                        stack[stackPtr] = null;
                    }
                    break;
                }

                // Jump location is in the code after jump instruction.
                case Instruction.Jmp:
                    instrPtr = code[instrPtr] as number;
                    break;

                // Conditional jumps only pop the value when NOT jumping.
                case Instruction.JmpIfTrue:
                    if (isTruthy(stack[stackPtr])) {
                        instrPtr = code[instrPtr ++] as number;
                    } else {
                        instrPtr ++;
                        stackPtr --;
                    }
                    break;

                case Instruction.JmpIfFalse:
                    if (!isTruthy(stack[stackPtr])) {
                        instrPtr = code[instrPtr ++] as number;
                    } else {
                        instrPtr ++;
                        stackPtr --;
                    }
                    break;

                case Instruction.JmpIfNull:
                    if (stack[stackPtr] == null) {
                        instrPtr = code[instrPtr ++] as number;
                    } else {
                        instrPtr ++;
                        stackPtr --;
                    }
                    break;

                case Instruction.JmpIfNotNull:
                    if (stack[stackPtr] != null) {
                        instrPtr = code[instrPtr ++] as number;
                    } else {
                        instrPtr ++;
                        stackPtr --;
                    }
                    break;

                case Instruction.AssertNotFunction:
                    if (typeof stack[stackPtr] === 'function') {
                        throw new TypeError(`found function where there cannot be one if allowTuringComplete=false`);
                    }
                    break;

                case Instruction.DeriveScope:
                {
                    const newScope = Object.create(scope);
                    stack[++ stackPtr] = scope;
                    scope = newScope;
                    break;
                }
                case Instruction.NewScope:
                {
                    const vars = stack[stackPtr --];
                    if (!vars || typeof vars !== 'object') {
                        throw new TypeError(`1st argument to 2 argument let needs to be an object`);
                    }
                    const newScope =
                        Object.getPrototypeOf(vars) === null ? vars :
                        Object.assign(Object.create(null), vars);
                    stack[++ stackPtr] = scope;
                    scope = newScope;
                    break;
                }
                case Instruction.PopScope:
                {
                    // old scope is below the top value on the stack
                    const value = stack[stackPtr --];
                    scope = stack[stackPtr];
                    stack[stackPtr] = value;
                    break;
                }
                case Instruction.Call:
                {
                    const op = stack[stackPtr];
                    const argc = code[instrPtr ++] as number;
                    const args = stack.slice(stackPtr - argc, stackPtr);
                    let result: any;
                    if (typeof op === 'function') {
                        result = op(...args);
                    } else if (op in operations) {
                        const func = operations[op];
                        result = func(...args);
                    } else {
                        throw new ReferenceError(`function is not defined: ${JSON.stringify(op)}`);
                    }
                    stackPtr -= argc;
                    stack[stackPtr] = result;
                    break;
                }
                case Instruction.Closure:
                {
                    const jmpPtr = code[instrPtr ++] as number;
                    stack[++ stackPtr] = function (...args: any[]) {
                        stack[++ stackPtr] = argc;
                        stack[++ stackPtr] = instrPtr;
                        stack[++ stackPtr] = framePtr;

                        framePtr = stackPtr + 1;
                        instrPtr = jmpPtr;
                        argc = args.length + 1;

                        stack[++ stackPtr] = this;
                        for (const arg of args) {
                            stack[++ stackPtr] = arg;
                        }

                        execIntern();

                        return stack[stackPtr --];
                    };
                    break;
                }
                case Instruction.Return:
                {
                    const result = stack[stackPtr];
                    stackPtr -= argc + 3;

                    if (stackPtr >= 0) {
                        argc     = stack[framePtr - 3];
                        instrPtr = stack[framePtr - 2];
                        framePtr = stack[framePtr - 1];

                        stack[stackPtr] = result;
                    }
                    return result;
                }
                case Instruction.Partial:
                {
                    const argc = code[instrPtr ++] as number;
                    stackPtr -= argc;
                    const op = stack[stackPtr];
                    let func: Function;
                    if (typeof op === 'function') {
                        func = op;
                    } else if (typeof op !== 'string') {
                        throw new SyntaxError(`illegal first argument to partial: ${JSON.stringify(op)}`);
                    } else if (op in operations) {
                        func = operations[op];
                    } else {
                        throw new ReferenceError(`function is not defined: ${JSON.stringify(op)}`);
                    }

                    if (argc > 0) {
                        const boundArgs = stack.slice(stackPtr, stackPtr + argc);
                        stack[stackPtr] = (...args: any[]) => func(...boundArgs, ...args);
                    } else {
                        stack[stackPtr] = func;
                    }
                    break;
                }

                case Instruction.NewArray:
                    stack[++ stackPtr] = [];
                    break;

                case Instruction.ArrayPush:
                    stack[stackPtr - 1].push(stack[stackPtr]);
                    stackPtr --;
                    break;

                case Instruction.NewObject:
                    stack[++ stackPtr] = {};
                    break;

                case Instruction.SetProp:
                    stack[stackPtr - 2][stack[stackPtr - 1]] = stack[stackPtr];
                    stackPtr -= 2;
                    break;

                default:
                    throw new ReferenceError(`illegal instruction: ${JSON.stringify(op)} (${typeof op})`);
            }
        }
    }

    const result = execIntern();
/*
    console.log({
        stack,
        stackPtr,
        instrPtr,
        framePtr,
        argc,
    });
*/
    return result;
}
