import { JsonListLogic } from './logic';
import { JsonListLogicSyntaxError } from './errors';

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
                        if (args[0] === 'let') {
                            const arg1 = args[1];
                            switch (args.length) {
                                case 3:
                                    if (typeof arg1 !== 'object') {
                                        throw new JsonListLogicSyntaxError(index, code, 'Expected non-primitive value as 1st argument to 2 argument let');
                                    }
                                    break;

                                case 4:
                                    if (Array.isArray(arg1)) {
                                        if (arg1[0] === 'var') {
                                            if (arg1.length !== 2 || typeof arg1[1] !== 'string') {
                                                throw new JsonListLogicSyntaxError(index, code, 'Illegal varialbe name declaration in 3 argument let');
                                            }
                                            args[1] = arg1[1];
                                        }
                                    } else if (typeof arg1 !== 'string') {
                                        throw new JsonListLogicSyntaxError(index, code, 'Illegal varialbe name declaration in 3 argument let');
                                    }
                                    break;

                                default:
                                    throw new JsonListLogicSyntaxError(index, code, 'Expected 2 to 3 arguments to let');
                            }
                        }
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
