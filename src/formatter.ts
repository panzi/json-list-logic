import { JsonListLogic } from './logic';
import { isValidName } from './utils';

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
