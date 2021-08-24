import { isTruthy, isValidName } from "./utils";
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

    // Jump location is in the code after jump instruction.
    Jmp,
    // Conditional jumps only pop the value when NOT jumping.
    JmpIfTrue,
    JmpIfFalse,
    JmpIfNotNull,

    AssertNotFunction,

    DeriveScope,
    NewScope,
    Partial,
    Call,
    Return,
    Stop,

    NewArray,
    ArrayPush,
    NewObject,
    SetProp,

    Closure,
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
                    const refs: number[] = [];
                    if (code.length < 2) {
                        throw new SyntaxError(`?? needs at least one argument: ${JSON.stringify(logic)}`);
                    }

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
                    if (typeof logic[1] !== 'string' || !isValidName(logic[1])) {
                        throw new TypeError(`first argument of var needs to be a name: ${JSON.stringify(logic)}`);
                    }
                    for (let index = 2; index < logic.length; ++ index) {
                        const key = logic[index];
                        switch (typeof key) {
                            case 'number':
                                break;

                            case 'string':
                                if (isValidName(key)) {
                                    break;
                                }
                                // fallthrough

                            default:
                                throw new TypeError(`var has illegal keys: ${JSON.stringify(logic)}`);
                        }
                    }
                    code.push(Instruction.GetVar, logic.slice(1) as (string | number)[]);
                    break;

                case 'arg':
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
                                break;

                            case 'string':
                                if (isValidName(key)) {
                                    break;
                                }
                                // fallthrough

                            default:
                                throw new TypeError(`arg has illegal keys: ${JSON.stringify(logic)}`);
                        }
                    }
                    code.push(Instruction.GetArg, logic.slice(1) as (string | number)[]);
                    break;

                case 'let':
                    switch (logic.length) {
                        case 3:
                            compileIntern(logic[1]);
                            code.push(Instruction.NewScope);
                            break;

                        case 4:
                            code.push(Instruction.DeriveScope);
                            const ref = code.length;
                            code.push(0);
                            let letInstr = logic;
                            let count = 0;
                            for (;;) {
                                ++ count;
                                const varName = letInstr[1];
                                if (typeof varName !== 'string' || !isValidName(varName)) {
                                    throw new SyntaxError(`1st argument to 3 argument let needs to be a string: ${JSON.stringify(letInstr)}`);
                                }
                                compileIntern(letInstr[2]);
                                const childInstr = letInstr[3];
                                if (Array.isArray(childInstr) && childInstr.length === 4 && childInstr[0] === 'let') {
                                    letInstr = childInstr;
                                } else {
                                    break;
                                }
                            }
                            code[ref] = count;
                            compileIntern(letInstr[3]);
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
                        // TODO
                    }
                    // TODO
                    throw new Error('not implemented');
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
                        code.push(Instruction.Push, operations[op], Instruction.Call, argc);
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
    code.push(Instruction.Stop);

    for (let index = 0; index < fns.length; ++ index) {
        const fn = fns[index];
        for (const ref of fn.refs) {
            code[ref] = code.length;
        }

        compileIntern(fn.body);
        code.push(Instruction.Return);
    }
    code.push(Instruction.Stop);

    return { code, operations };
}

export function execByteCode(code: CompiledLogic, input?: Scope|null): any {
    let stackPtr = 0;
    let argc = 0;
    // TODO
    throw new Error('not implemented');
}
