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
import BigNumber from 'bignumber.js';
import { describe, expect, test } from 'vitest';
import { type Page } from '../../../src/schuh/controller/page.js';
import { SchuhMitModell } from '../../../src/schuh/service/schuh-service.ts';
import { Schuh } from '../../../src/generated/prisma/client.js';
import { CONTENT_TYPE, restURL } from '../constants.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const modellArray = ['nmd', 'suede', 'classic'];
const modellNichtVorhanden = ['xxx', 'yyy', 'zzz'];
const artikelnummern = ['SH001-ADNMD', 'SH004-PUSU', 'SH005-RECL'];
const bewertungMin = [3, 4];
const preisMax = [33.5, 66.6];
const schlagwoerter = ['sport', 'streetwear'];
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

    test.concurrent.each(modellArray)(
        'Schuhe mit Teil-Modell %s suchen',
        async (modell) => {
            // given
            const params = new URLSearchParams({ modell });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<SchuhMitModell>;

            expect(body).toBeDefined();

            // Jedes Schuh hat ein Modell mit dem Teilstring
            body.content
                .map((schuh) => schuh.modell)
                .forEach((t) =>
                    expect(t?.modell?.toLowerCase()).toStrictEqual(
                        expect.stringContaining(modell),
                    ),
                );
        },
    );

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

    test.concurrent.each(artikelnummern)(
        'Schuh mit Artikelnummer %s suchen',
        async (artikelnummer) => {
            // given
            const params = new URLSearchParams({ artikelnummer });
            const url = `${restURL}?${params}`;

        // when
        const response = await fetch(url);
        const { status, headers } = response;

        // then
        expect(status).toBe(HttpStatus.OK);
        expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

        const body = (await response.json()) as Page<Schuh>;

        expect(body).toBeDefined();

        // 1 Schuh mit der Artikelnummer
        const schuhe = body.content;

        expect(schuhe).toHaveLength(1);

        const [schuh] = schuhe;
        const artikelnummerFound = schuh?.artikelnummer;

        expect(artikelnummerFound).toBe(artikelnummer);
    });

    test.concurrent.each(bewertungMin)(
        'Schuhe mit Mindest-"bewertung" %i suchen',
        async (bewertung) => {
            // given
            const params = new URLSearchParams({
                bewertung: bewertung.toString(),
            });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<Schuh>;

            // Jedes Schuh hat eine Bewertung >= bewertung
            body.content
                .map((schuh) => schuh.bewertung)
                .forEach((r) => expect(r).toBeGreaterThanOrEqual(bewertung));
        },
    );

    test.concurrent.each(preisMax)(
        'Schuhe mit max. Preis %d suchen',
        async (preis) => {
            // given
            const params = new URLSearchParams({ preis: preis.toString() });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<Schuh>;

            // Jedes Schuh hat einen Preis <= preis
            body.content
                .map((schuh) => BigNumber(schuh?.preis?.toString() ?? 0))
                .forEach((p) =>
                    expect(p.isLessThanOrEqualTo(BigNumber(preis))).toBe(true),
                );
        },
    );

    test.concurrent.each(schlagwoerter)(
        'Mind. 1 Schuh mit Schlagwort %s',
        async (schlagwort) => {
            // given
            const params = new URLSearchParams({ [schlagwort]: 'true' });
            const url = `${restURL}?${params}`;

            // when
            const response = await fetch(url);
            const { status, headers } = response;

            // then
            expect(status).toBe(HttpStatus.OK);
            expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

            const body = (await response.json()) as Page<Schuh>;

            // JSON-Array mit mind. 1 JSON-Objekt
            expect(body).toBeDefined();

            // Jedes Schuh hat im Array der Schlagwoerter z.B. "javascript"
            body.content
                .map((schuh) => schuh.schlagwoerter)
                .forEach((schlagwoerter) =>
                    expect(schlagwoerter).toStrictEqual(
                        expect.arrayContaining([schlagwort.toUpperCase()]),
                    ),
                );
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
