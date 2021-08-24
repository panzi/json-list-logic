import 'source-map-support/register';
import { parseLogic, execLogic, formatLogic } from "../src";
import { compileLogic, execByteCode } from "../src/bytecode";
// import { promises as fs } from "fs";
import * as util from "util";

function indent(str: string, width=4): string {
    const padding = ''.padStart(width);
    return padding + str.replace(/\n/g, '\n' + padding);
}

async function main(): Promise<void> {
    // TODO
    const code = process.argv[2]; // await fs.readFile(process.argv[2], 'utf-8');
    const input = process.argv.length > 3 ?
        JSON.parse(process.argv[3]) :
        // JSON.parse(await fs.readFile(process.argv[3], 'utf-8')) :
        undefined;
    const logic = parseLogic(code);

    console.log('Original Code:')
    console.log(indent(code));
    console.log();

    console.log('JSON Code:')
    console.log(indent(util.inspect(logic, { depth: null, colors: true})));
    console.log();

    console.log('Formatted Code:')
    console.log(indent(formatLogic(logic, 4, 25)));
    console.log();

    const compiled = compileLogic(logic);
    console.log('Byte Code:')
    console.log(indent(util.inspect(compiled.code, { depth: null, colors: true})));
    console.log();

    console.log('Input:');
    console.log(indent(util.inspect(input, { depth: null, colors: true})));
    console.log();

    console.log('Output execLogic():');
    console.log(indent(util.inspect(execLogic(logic, input), { depth: null, colors: true})));
    console.log();

    console.log('Output execByteCode():');
    console.log(indent(util.inspect(execByteCode(compiled, input), { depth: null, colors: true})));
    console.log();
}

main();
