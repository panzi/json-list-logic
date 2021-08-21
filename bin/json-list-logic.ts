import 'source-map-support/register';
import { parseLogic, execLogic, formatLogic } from "../src";
import { promises as fs } from "fs";
import * as util from "util";

async function main(): Promise<void> {
    // TODO
    const code = await fs.readFile(process.argv[2], 'utf-8');
    const input = process.argv.length > 3 ? JSON.parse(await fs.readFile(process.argv[3], 'utf-8')) : undefined;
    const logic = parseLogic(code);

    console.log('code:', util.inspect(logic, { depth: null, colors: true}));
    console.log('output:', util.inspect(execLogic(logic, input), { depth: null, colors: true}));
    console.log('formatted:', formatLogic(logic, 4));
}

main();
