import { describe, it, expect, test, beforeAll, afterAll } from '@jest/globals';
import MockDate from 'mockdate';
import * as fs from 'fs';
import * as path from 'path';
import { parseLogic, execLogic, JsonListLogic } from '../src';

interface Example {
    name: string,
    code: any,
}

// fake now for tests:
const MOCK_DATE_TIME = '2021-08-17T15:10:00+02:00';
const MOCK_NOW = new Date(MOCK_DATE_TIME).getTime();

function timeAgo(time: { days?: number, hours?: number, minutes?: number, seconds?: number, millies?: number }): Date {
    let timestamp = MOCK_NOW;

    if (time.days) {
        timestamp -= time.days * 24 * 60 * 60 * 1000;
    }

    if (time.hours) {
        timestamp -= time.hours * 60 * 60 * 1000;
    }

    if (time.minutes) {
        timestamp -= time.minutes * 60 * 1000;
    }

    if (time.seconds) {
        timestamp -= time.seconds * 1000;
    }

    if (time.millies) {
        timestamp -= time.millies;
    }

    const date = new Date();
    date.setTime(timestamp);
    return date;
}

function timeIn(time: { days?: number, hours?: number, minutes?: number, seconds?: number, millies?: number }): Date {
    let timestamp = MOCK_NOW;

    if (time.days) {
        timestamp += time.days * 24 * 60 * 60 * 1000;
    }

    if (time.hours) {
        timestamp += time.hours * 60 * 60 * 1000;
    }

    if (time.minutes) {
        timestamp += time.minutes * 60 * 1000;
    }

    if (time.seconds) {
        timestamp += time.seconds * 1000;
    }

    if (time.millies) {
        timestamp += time.millies;
    }

    const date = new Date();
    date.setTime(timestamp);
    return date;
}

const validExamples: Example[] = [
    {
        name: 'PCR Test',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'CovidTest',
                    testedAt: new Date('2021-08-16T15:10:00+02:00'),
                    testType: 'PCR',
                    selfTest: false,
                }
            ]
        }
    },
    {
        name: 'AntiGen Test',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'CovidTest',
                    testedAt: new Date('2021-08-16T15:10:00+02:00'),
                    testType: 'AntiGen',
                    selfTest: false,
                }
            ]
        }
    },
    {
        name: 'Self-Test',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'CovidTest',
                    testedAt: new Date('2021-08-16T15:10:00+02:00'),
                    selfTest: true,
                }
            ]
        }
    },
    {
        name: 'Vaccination with Comirnaty (Biontech/Pfizer)',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: new Date('2021-08-16T15:10:00+02:00'),
                    vaccine: 'EU/1/20/1528',
                    doseNumber: 2,
                    totalDoses: 2,
                }
            ]
        }
    },
    {
        name: 'Vaccination with COVID-19 Vaccine Moderna',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: new Date('2021-08-16T15:10:00+02:00'),
                    vaccine: 'EU/1/20/1507',
                    doseNumber: 2,
                    totalDoses: 2,
                }
            ]
        }
    },
    {
        name: 'Vaccination with Vaxzevria (AstraZeneca)',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: new Date('2021-08-16T15:10:00+02:00'),
                    vaccine: 'EU/1/21/1529',
                    doseNumber: 2,
                    totalDoses: 2,
                }
            ]
        }
    },
    {
        name: 'Vaccination with COVID-19 Vaccine Janssen (Johnson & Johnson)',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: timeAgo({ days: 22 }),
                    vaccine: 'EU/1/20/1525',
                    doseNumber: 1,
                    totalDoses: 1,
                }
            ]
        }
    },
    {
        name: 'Recovery',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Recovery',
                    infectedAt:  timeAgo({ days: 200 }),
                    recoveredAt: timeAgo({ days: 180 }),
                }
            ]
        }
    },
    {
        name: 'Recovery + Vaccination',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Recovery',
                    infectedAt:  timeAgo({ days: 200 }),
                    recoveredAt: timeAgo({ days: 181 }),
                },
                {
                    type: 'Vaccination',
                    vaccinatedAt: timeAgo({ days: 179 }),
                    vaccine: 'EU/1/20/1528',
                    doseNumber: 1,
                    totalDoses: 2,
                }
            ]
        }
    }
];

const invalidExamples: Example[] = [
    {
        name: 'Test in future',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'CovidTest',
                    testedAt: timeIn({ hours: 3 }),
                    testType: 'PCR',
                    selfTest: false,
                }
            ]
        }
    },
    {
        name: '1 second too old PCR test',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'CovidTest',
                    testedAt: timeAgo({ hours: 72, seconds: 1 }),
                    testType: 'PCR',
                    selfTest: false,
                }
            ]
        }
    },
    {
        name: 'Way too old AntiGen test',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'CovidTest',
                    testedAt: timeAgo({ days: 365 }),
                    testType: 'AntiGen',
                    selfTest: false,
                }
            ]
        }
    },
    {
        name: '1 second too old AntiGen test',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'CovidTest',
                    testedAt: timeAgo({ hours: 48, seconds: 1 }),
                    testType: 'AntiGen',
                    selfTest: false,
                }
            ]
        }
    },
    {
        name: 'Way too old Self-Test',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'CovidTest',
                    testedAt: timeAgo({ days: 365 }),
                    selfTest: true,
                }
            ]
        }
    },
    {
        name: '1 second too old Self-Test',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'CovidTest',
                    testedAt: timeAgo({ hours: 24, seconds: 1 }),
                    selfTest: true,
                }
            ]
        }
    },
    {
        name: 'Vaccination with Comirnaty claiming 1 of 1',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: new Date('2021-08-16T15:10:00+02:00'),
                    vaccine: 'EU/1/20/1528',
                    doseNumber: 1,
                    totalDoses: 1,
                }
            ]
        }
    },
    {
        name: 'Vaccination with COVID-19 Vaccine Moderna claiming 1 of 1',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: new Date('2021-08-16T15:10:00+02:00'),
                    vaccine: 'EU/1/20/1507',
                    doseNumber: 1,
                    totalDoses: 1,
                }
            ]
        }
    },
    {
        name: 'Vaccination with Vaxzevria (AstraZeneca) claiming 1 of 1',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: new Date('2021-08-16T15:10:00+02:00'),
                    vaccine: 'EU/1/21/1529',
                    doseNumber: 1,
                    totalDoses: 1,
                }
            ]
        }
    },
    {
        name: 'Way too old vaccination with Comirnaty',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: timeAgo({ days: 365 }),
                    vaccine: 'EU/1/20/1528',
                    doseNumber: 2,
                    totalDoses: 2,
                }
            ]
        }
    },
    {
        name: '1 second too old vaccination with Comirnaty',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: timeAgo({ days: 270, seconds: 1 }),
                    vaccine: 'EU/1/20/1528',
                    doseNumber: 2,
                    totalDoses: 2,
                }
            ]
        }
    },
    {
        name: '1 second too old vaccination with COVID-19 Vaccine Janssen',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: timeAgo({ days: 270, seconds: 1 }),
                    vaccine: 'EU/1/20/1525',
                    doseNumber: 1,
                    totalDoses: 1,
                }
            ]
        }
    },
    {
        name: 'Vaccination in the future',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: timeIn({ days: 1 }),
                    vaccine: 'EU/1/20/1525',
                    doseNumber: 1,
                    totalDoses: 1,
                }
            ]
        }
    },
    {
        name: 'Too recent vaccination with COVID-19 Vaccine Janssen',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Vaccination',
                    vaccinatedAt: timeAgo({ days: 20, hours: 23, minutes: 59, seconds: 59 }),
                    vaccine: 'EU/1/20/1525',
                    doseNumber: 1,
                    totalDoses: 1,
                }
            ]
        }
    },
    {
        name: 'Way too old recovery',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Recovery',
                    infectedAt:  timeAgo({ days: 400 }),
                    recoveredAt: timeAgo({ days: 380 }),
                }
            ]
        }
    },
    {
        name: '1 second too old Recovery',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Recovery',
                    infectedAt:  timeAgo({ days: 200 }),
                    recoveredAt: timeAgo({ days: 180, seconds: 1 }),
                }
            ]
        }
    },
    {
        name: 'Recovery in future',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Recovery',
                    infectedAt:  timeAgo({ days: 2 }),
                    recoveredAt: timeIn({ days: 3 }),
                }
            ]
        }
    },
    {
        name: 'Infection in future',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Recovery',
                    infectedAt:  timeIn({ days: 2 }),
                    recoveredAt: timeIn({ days: 3 }),
                }
            ]
        }
    },
    {
        name: 'Infection after recovery',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Recovery',
                    infectedAt:  timeAgo({ days: 2 }),
                    recoveredAt: timeAgo({ days: 3 }),
                }
            ]
        }
    },
    {
        name: '1st Vaccination with too recent recovery',
        code: {
            photoId: 'e2c18b90-2a32-44a7-b7e2-913e69b4b93f',
            photoKey: Buffer.from('fb6bZcTZoJc6f1fVTxI45xpFEQqra5q6LbCCUrf2iTg=', 'base64'),
            events: [
                {
                    type: 'Recovery',
                    infectedAt:  timeAgo({ days: 200 }),
                    recoveredAt: timeAgo({ days: 190 }),
                },
                {
                    type: 'Vaccination',
                    vaccinatedAt: timeAgo({ days: 180, seconds: 1 }),
                    vaccine: 'EU/1/20/1507',
                    doseNumber: 1,
                    totalDoses: 2,
                }
            ]
        }
    }
];

beforeAll(() => {
    MockDate.set(MOCK_DATE_TIME);
});

afterAll(() => {
    MockDate.reset();
});

function loadRules(): JsonListLogic {
    const data = fs.readFileSync(path.join(__dirname, 'ehc.jll'), 'utf-8');
    return parseLogic(data);
}

test('parseRules()', () => {
    const rules = loadRules();
    expect(typeof rules).toBe('object');
});

describe('test valid QR-codes', () => {
    let generalRules: JsonListLogic|null = null;

    beforeAll(() => {
        generalRules = loadRules();
    });

    validExamples.forEach(example => {
        it(example.name, () => {
            if (generalRules === null) {
                throw new Error(`rules where not loaded before running test ${example.name}`);
            }
            const result = execLogic(generalRules, example.code);
            expect(result).toBe(true);
        });
    });

    it('selects vaccination dates', () => {
        const rule = `
        (map
            (filter
                events
                (fn (let $1
                    (and
                        (== type "Vaccination")
                        (in vaccine [
                            "EU/1/20/1528"
                            "EU/1/20/1507"
                            "EU/1/21/1529"
                            "EU/1/20/1525"
                        ])
                        (<=
                            0
                            (timeSince vaccinatedAt)
                            (days 270)
                        )
                        (>= doseNumber 1)
                    )
                ))
            )
            (fn (timestamp (arg 1 vaccinatedAt)))
        )`;

        const logic = parseLogic(rule);
        const data = validExamples[validExamples.length - 1].code;
        const result = execLogic(logic, data);
        expect(result).toEqual([timeAgo({ days: 179 }).getTime()]);
    });

    it('selects infection dates', () => {
        const rule = `
        (map
            (filter
                events
                (fn (let $1
                    (and
                        (== type "Recovery")
                        (<=
                            0
                            (timeSince recoveredAt)
                        )
                        (<
                            (timestamp infectedAt)
                            (timestamp recoveredAt)
                        )
                    )
                ))
            )
            (fn (timestamp (arg 1 infectedAt)))
        )`;

        const logic = parseLogic(rule);
        const data = validExamples[validExamples.length - 1].code;
        const result = execLogic(logic, data);
        expect(result).toEqual([timeAgo({ days: 200 }).getTime()]);
    });
});

describe('test invalid QR-codes', () => {
    let generalRules: JsonListLogic|null = null;

    beforeAll(() => {
        generalRules = loadRules();
    });

    invalidExamples.forEach(example => {
        it(example.name, () => {
            if (generalRules === null) {
                throw new Error(`rules where not loaded before running test ${example.name}`);
            }
            const result = execLogic(generalRules, example.code);
            expect(result).toBe(false);
        });
    });
});
