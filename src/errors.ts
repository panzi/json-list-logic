export class JsonListLogicError extends Error {
    constructor(message: string) {
        super(message);

        this.name = this.constructor.name;
        if ('captureStackTrace' in Error) {
            Error.captureStackTrace(this, this.constructor);
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
