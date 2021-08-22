import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { parseLogic, execLogic } from '../src';

const code1 = fs.readFileSync(path.join(__dirname, 'code1.jll'), 'utf-8');
const code2 = fs.readFileSync(path.join(__dirname, 'code2.jll'), 'utf-8');
const code3 = fs.readFileSync(path.join(__dirname, 'code3.jll'), 'utf-8');
const code4 = fs.readFileSync(path.join(__dirname, 'code4.jll'), 'utf-8');
const code5 = fs.readFileSync(path.join(__dirname, 'code5.jll'), 'utf-8');
const code6 = fs.readFileSync(path.join(__dirname, 'code6.jll'), 'utf-8');
const code7 = fs.readFileSync(path.join(__dirname, 'code7.jll'), 'utf-8');
const code8 = fs.readFileSync(path.join(__dirname, 'code8.jll'), 'utf-8');

// TODO: thorough testing
describe('parse', () => {
    it(`code1.jll`, () => {
        expect(parseLogic(code1)).toEqual([ 'print', 'hello world\nspecial: Ü\t"/\\' ]);
    });

    it(`code2.jll`, () => {
        expect(parseLogic(code2)).toEqual([
            '==',
            [ 'length', [ 'array', 1, 2, 3 ] ],
            [ 'length', [ 'array', 'ahh', 'bee', 'cee' ] ]
          ]);
    });

    it(`code3.jll`, () => {
        expect(parseLogic(code3)).toEqual([ '*', [ 'var', 'foo', 'bar' ], 2, [ '+', 1, 2, 3 ] ]);
    });

    it(`code4.jll`, () => {
        expect(parseLogic(code4)).toEqual([ 'map', [ 'var', 'values' ], [ 'fn', [ 'x' ], [ '+', ['var', 'x'], 1 ] ] ]);
    });

    it(`code5.jll`, () => {
        expect(parseLogic(code5)).toEqual([ 'map', [ 'var', 'values' ], [ 'fn', [], [ '+', ['arg', 1], 1 ] ] ]);
    });

    it(`code6.jll`, () => {
        expect(parseLogic(code6)).toEqual({"bar": -Infinity, "baz": NaN, "foo": 123, "x": ["object", ["array", ["string", ["var", "a"], " ", ["var", "b"]], ["/", 5, 2]]]});
    });

    it(`code7.jll`, () => {
        expect(parseLogic(code7)).toEqual(["reduce", ["zip", ["array", "a", "b"], ["array", 4, 5]], ["fn", ["str", "item"], ["string", ["var", "str"], ["if", ["var", "str"], ", ", ""], ["var", "item", 0], " -> ", ["var", "item", 1]]], ""]);
    });
});

describe('exec', () => {
    it(`code1.jll`, () => {
        const console_log = console.log;
        let last_out: any[]|undefined;
        console.log = (...args: any[]) => {
            last_out = args;
        };
        try {
            expect(execLogic(parseLogic(code1))).toEqual('hello world\nspecial: Ü\t"/\\');
        } finally {
            console.log = console_log;
        }
        expect(last_out).toEqual(['hello world\nspecial: Ü\t"/\\']);
    });

    it(`code2.jll`, () => {
        expect(execLogic(parseLogic(code2))).toEqual(true);
    });

    it(`code3.jll`, () => {
        expect(execLogic(parseLogic(code3), {foo: {bar: -1}})).toEqual(-12);
    });

    it(`code4.jll`, () => {
        expect(execLogic(parseLogic(code4), {values: [1, 2, 3]})).toEqual([2, 3, 4]);
    });

    it(`code5.jll`, () => {
        expect(execLogic(parseLogic(code5), {values: [1, 2, 3]})).toEqual([2, 3, 4]);
    });

    it(`code6.jll`, () => {
        expect(execLogic(parseLogic(code6), {a: 'hello'})).toEqual({
            foo: 123,
            bar: -Infinity,
            baz: NaN,
            x: {'hello ': 2.5},
        });
    });

    it(`code7.jll`, () => {
        expect(execLogic(parseLogic(code7))).toEqual("a -> 4, b -> 5");
    });

    it(`between`, () => {
        expect(execLogic(['<', 1, 2, 3])).toBe(true);
    });

    it(`fn`, () => {
        expect(execLogic(['map', ['array', 1, 2, 3], ['fn', ['-', ['arg', 1], 2]]])).toEqual([-1, 0, 1]);
    });

    it(`partial`, () => {
        expect(execLogic(['map', ['array', 1, 2, 3], ['partial', '-', 2]])).toEqual([1, 0, -1]);
    });

    it(`fibonacci`, () => {
        const fib = [
            'fn', ['fib', 'n'],
            ['if', ['<', ['var', 'n'], 2],
                ['var', 'n'],
                ['+',
                    [['var', 'fib'], ['var', 'fib'], ['-', ['var', 'n'], 1]],
                    [['var', 'fib'], ['var', 'fib'], ['-', ['var', 'n'], 2]],
                ]
            ]
        ];
        expect(execLogic([fib, fib, 12] as any, {})).toBe(144);

        const logic = parseLogic(code8);
        expect(execLogic(logic, {n: 12})).toBe(144);
    });
});

