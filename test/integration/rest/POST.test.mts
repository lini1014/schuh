// Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
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
import { beforeAll, describe, expect, test } from 'vitest';
import { type SchuhDTO } from '../../../src/schuh/controller/schuh-dto.ts';
import { SchuhService } from '../../../src/schuh/service/schuh-service.ts';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    LOCATION,
    POST,
    restURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const neuesSchuh: Omit<SchuhDTO, 'preis' | 'rabattsatz'> & {
    preis: number;
    rabattsatz: number;
} = {
    artikelnummer: 'SH999-NEU',
    bewertung: 3,
    typ: 'SNEAKER',
    preis: 99.99,
    rabattsatz: 0.1,
    verfuegbar: true,
    erscheinungsdatum: '2025-02-28',
    homepage: 'https://post.rest',
    schlagwoerter: ['SPORT', 'STREETWARE'],
    modell: {
        modell: 'Modellpost',
        farbe: 'rot',
    },
    abbildungen: [
        {
            beschriftung: 'Abb. 1',
            contentType: 'img/png',
        },
    ],
};
const neuesSchuhInvalid: Record<string, unknown> = {
    artikelnummer: 'falsche-Artikelnummer',
    bewertung: -1,
    typ: 'UNSICHTBAR',
    preis: -1,
    rabattsatz: 2,
    verfuegbar: true,
    erscheinungsdatum: '12345-123-123',
    homepage: 'anyHomepage',
    modell: {
        modell: '?!',
        farbe: 'Untermodellinvalid',
    },
};
const neuesSchuhArtikelnummerExistiert: SchuhDTO = {
    artikelnummer: 'SH001-ADNMD',
    bewertung: 4,
    typ: 'SNEAKER',
    preis: new BigNumber(129),
    rabattsatz: new BigNumber(0.1),
    verfuegbar: true,
    erscheinungsdatum: '2024-03-15',
    homepage: 'https://www.adidas.de/nmd',
    schlagwoerter: ['SPORT'],
    modell: {
        modell: 'Adidas NMD',
        farbe: 'core black',
    },
    abbildungen: [],
};

type MessageType = { message: string };

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('POST /rest', () => {
    let token: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
    });

    test('Neues Schuh', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesSchuh),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.CREATED);

        const responseHeaders = response.headers;
        const location = responseHeaders.get(LOCATION);

        expect(location).toBeDefined();

        // ID nach dem letzten "/"
        const indexLastSlash = location?.lastIndexOf('/') ?? -1;

        expect(indexLastSlash).not.toBe(-1);

        const idStr = location?.slice(indexLastSlash + 1);

        expect(idStr).toBeDefined();
        expect(SchuhService.ID_PATTERN.test(idStr ?? '')).toBe(true);
    });

    test.concurrent('Neues Schuh mit ungueltigen Daten', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        const expectedMsg = [
            expect.stringMatching(/^artikelnummer /u),
            expect.stringMatching(/^bewertung /u),
            expect.stringMatching(/^typ /u),
            expect.stringMatching(/^preis /u),
            expect.stringMatching(/^rabattsatz /u),
            expect.stringMatching(/^erscheinungsdatum /u),
            expect.stringMatching(/^homepage /u),
            expect.stringMatching(/^modell.modell /u),
        ];

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesSchuhInvalid),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.BAD_REQUEST);

        const body = (await response.json()) as MessageType;
        const messages = body.message;

        expect(messages).toBeDefined();
        expect(messages).toHaveLength(expectedMsg.length);
        expect(messages).toStrictEqual(expect.arrayContaining(expectedMsg));
    });

    test.concurrent(
        'Neues Schuh, aber die Artikelnummer existiert bereits',
        async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesSchuhArtikelnummerExistiert),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);

        const body = (await response.json()) as MessageType;

        expect(body.message).toStrictEqual(
            expect.stringContaining('Artikelnummer'),
        );
    });

    test.concurrent('Neues Schuh, aber ohne Token', async () => {
        // when
        const { status } = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesSchuh),
        });

        // then
        expect(status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test.concurrent('Neues Schuh, aber mit falschem Token', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

        // when
        const { status } = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuesSchuh),
            headers,
        });

        // then
        expect(status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test.concurrent.todo('Abgelaufener Token');
});
