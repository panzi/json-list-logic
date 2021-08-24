const KEYWORDS = new Set<string>([
    'fn', 'var', 'arg', 'let', 'if', 'and', 'or', '??', 'partial',
    'Infinity', 'NaN', 'null', 'true', 'false',
]);

export const hasOwnProperty = Object.prototype.hasOwnProperty;

export function isValidName(name: string): boolean {
    return /^[a-zA-Z][_a-zA-Z0-9]*/.test(name) && !KEYWORDS.has(name);
}

export function toString(value: any): string {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/*
    /^([0-9]+)-([0-9]{1,2})-([0-9]{1,2})
    (?:[T ]
        ([0-9]{1,2})
        (?:
            :
            ([0-9]{1,2})
            (?:
                :
                ([0-9]{1,2}(?:\.[0-9]{3})?)?
                (Z|([-+])([0-9]{2}):([0-9]{2}))
            )?
        )?
    )?$/
*/
const DATETIME_PATTERN = /^([0-9]+)-([0-9]{1,2})-([0-9]{1,2})(?:[T ]([0-9]{1,2})(?::([0-9]{1,2})(?::([0-9]{1,2})((?:\.[0-9]{3})?)?(Z|([-+])([0-9]{2}):([0-9]{2})))?)?)?$/;

// only accept ISO date-times
export function parseDate(value: string): Date {
    if (typeof value !== 'string') {
        throw new TypeError(`illegal argument type passed to parseDate(): ${typeof value}`);
    }

    if (!DATETIME_PATTERN.test(value)) {
        throw new TypeError(`illegal date-time string: ${JSON.stringify(value)}`);
    }

    return new Date(value);
}

export function toDate(value: any): Date {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'string') {
        return parseDate(value);
    }

    const date = new Date();
    date.setTime(value);

    return date;
}

export function isTruthy(value: any): boolean {
    if (!value) {
        return false;
    }

    if (Array.isArray(value)) {
        return value.length !== 0;
    }

    if (typeof value === 'object') {
        for (const _ in value) {
            return true;
        }
        return false;
    }

    return !!value;
}
