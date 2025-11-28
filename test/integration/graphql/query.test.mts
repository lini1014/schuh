/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Copyright (C) 2025 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import { type GraphQLRequest } from '@apollo/server';
import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import {
    ACCEPT,
    APPLICATION_JSON,
    CONTENT_TYPE,
    GRAPHQL_RESPONSE_JSON,
    POST,
    graphqlURL,
} from '../constants.mjs';

type SchuhResponse = {
    schuh?: {
        artikelnummer: string;
        bewertung: number;
        typ: string | null;
        modell: { modell: string };
    } | null;
    schuhe?:
        | {
              artikelnummer: string;
              bewertung: number;
              typ: string | null;
              modell: { modell: string };
          }[]
        | null;
};

type GraphQLResult = { data: SchuhResponse; errors?: { message: string }[] };

const bestehendeIds = [1, 3];
const modellSuche = ['adidas', 'suede'];
const artikelnummern = ['SH001-ADNMD', 'SH004-PUSU'];

describe('GraphQL Queries (Schuh)', () => {
    let headers: Headers;

    beforeAll(() => {
        headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
    });

    test.concurrent.each(bestehendeIds)('Schuh zu ID %i', async (id) => {
        const query: GraphQLRequest = {
            query: `
                {
                    schuh(id: "${id}") {
                        artikelnummer
                        bewertung
                        typ
                        modell {
                            modell
                        }
                    }
                }
            `,
        };

        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        expect(response.status).toBe(HttpStatus.OK);

        const { data, errors } = (await response.json()) as GraphQLResult;

        expect(errors).toBeUndefined();
        expect(data.schuh).toBeDefined();
        expect(data.schuh?.artikelnummer).toMatch(/^SH00/iu);
        expect(data.schuh?.modell.modell).toMatch(/^\w/iu);
    });

    test('Schuh zu nicht vorhandener ID', async () => {
        const query: GraphQLRequest = {
            query: `
                {
                    schuh(id: "9999") {
                        artikelnummer
                    }
                }
            `,
        };

        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        expect(response.status).toBe(HttpStatus.OK);

        const { data, errors } = (await response.json()) as GraphQLResult;

        expect(data.schuh).toBeNull();
        expect(errors).toBeDefined();
        expect(errors![0]?.message).toMatch(/kein Schuh/iu);
    });

    test.concurrent.each(modellSuche)(
        'Schuhe zum Modell-Teilstring %s',
        async (modell) => {
            const query: GraphQLRequest = {
                query: `
                    {
                        schuhe(suchparameter: {
                            modell: "${modell}"
                        }) {
                            artikelnummer
                            modell {
                                modell
                            }
                        }
                    }
                `,
            };

            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            expect(response.status).toBe(HttpStatus.OK);

            const { data, errors } = (await response.json()) as GraphQLResult;

            expect(errors).toBeUndefined();
            expect(data.schuhe).toBeDefined();
            expect(data.schuhe).not.toHaveLength(0);

            data.schuhe!.forEach((schuh) =>
                expect(schuh.modell.modell.toLowerCase()).toContain(
                    modell.toLowerCase(),
                ),
            );
        },
    );

    test.concurrent.each(artikelnummern)(
        'Schuh zu Artikelnummer %s',
        async (artikelnummer) => {
            const query: GraphQLRequest = {
                query: `
                    {
                        schuhe(suchparameter: {
                            artikelnummer: "${artikelnummer}"
                        }) {
                            artikelnummer
                            modell {
                                modell
                            }
                        }
                    }
                `,
            };

            const response = await fetch(graphqlURL, {
                method: POST,
                body: JSON.stringify(query),
                headers,
            });

            expect(response.status).toBe(HttpStatus.OK);

            const { data, errors } = (await response.json()) as GraphQLResult;

            expect(errors).toBeUndefined();
            expect(data.schuhe).toHaveLength(1);
            expect(data.schuhe?.[0]?.artikelnummer).toBe(artikelnummer);
        },
    );

    test('Schuhe zur typ LAUFSCHUH', async () => {
        const query: GraphQLRequest = {
            query: `
                {
                    schuhe(suchparameter: {
                        typ: LAUFSCHUH
                    }) {
                        typ
                    }
                }
            `,
        };

        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        expect(response.status).toBe(HttpStatus.OK);

        const { data, errors } = (await response.json()) as GraphQLResult;

        expect(errors).toBeUndefined();
        expect(data.schuhe).not.toHaveLength(0);

        data.schuhe!.forEach((schuh) => expect(schuh.typ).toBe('LAUFSCHUH'));
    });

    test('Schuhe zu einer ungültigen typ', async () => {
        const query: GraphQLRequest = {
            query: `
                {
                    schuhe(suchparameter: {
                        typ: UNGUELTIG
                    }) {
                        artikelnummer
                    }
                }
            `,
        };

        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(query),
            headers,
        });

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /graphql-response\+json/iu,
        );
    });
});

/* eslint-enable @typescript-eslint/no-non-null-assertion */
