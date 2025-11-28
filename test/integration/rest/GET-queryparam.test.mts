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

import { HttpStatus } from '@nestjs/common';
import { describe, expect, test } from 'vitest';
import { type Page } from '../../../src/schuh/controller/page.js';
import { Schuh } from '../../../src/generated/prisma/client.js';
import { CONTENT_TYPE, restURL } from '../constants.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const modellNichtVorhanden = ['xxx', 'yyy', 'zzz'];
const schlagwoerterNichtVorhanden = ['csharp', 'cobol'];

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('GET /rest', () => {
    test.concurrent('Alle Schuhe', async () => {
        // given

        // when
        const response = await fetch(restURL);
        const { status, headers } = response;

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

        const body = (await response.json()) as Page<Schuh>;

        body.content
            .map((schuh) => schuh.id)
            .forEach((id) => {
                expect(id).toBeDefined();
            });
    });

    test.concurrent.each(modellNichtVorhanden)(
        'Schuhe zu nicht vorhandenem Teil-Modell %s suchen',
        async (modell) => {
            // given
            const params = new URLSearchParams({ modell });
            const url = `${restURL}?${params}`;

            // when
            const { status } = await fetch(url);

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );

    test.concurrent.each(schlagwoerterNichtVorhanden)(
        'Keine Schuhe zu einem nicht vorhandenen Schlagwort',
        async (schlagwort) => {
            const params = new URLSearchParams({ [schlagwort]: 'true' });
            const url = `${restURL}?${params}`;

            // when
            const { status } = await fetch(url);

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );

    test.concurrent(
        'Keine Schuhe zu einer nicht-vorhandenen Property',
        async () => {
            // given
            const params = new URLSearchParams({ foo: 'bar' });
            const url = `${restURL}?${params}`;

            // when
            const { status } = await fetch(url);

            // then
            expect(status).toBe(HttpStatus.NOT_FOUND);
        },
    );
});
