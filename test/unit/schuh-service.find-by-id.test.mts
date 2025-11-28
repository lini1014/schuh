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

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PrismaService } from '../../src/schuh/service/prisma-service.js';
import {
    type SchuhMitModellUndAbbildungen,
    SchuhService,
} from '../../src/schuh/service/schuh-service.js';
import { WhereBuilder } from '../../src/schuh/service/where-builder.js';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { Schuhtyp } from '../../src/generated/prisma/enums.js';

describe('SchuhService findById', () => {
    let service: SchuhService;
    let prismaServiceMock: PrismaService;

    beforeEach(() => {
        const findUniqueMock = vi.fn<PrismaClient['schuh']['findUnique']>();
        prismaServiceMock = {
            client: {
                schuh: {
                    findUnique: findUniqueMock,
                },
            },
        } as any; // cast since we don’t need the full PrismaService here

        const whereBuilder = new WhereBuilder();

        service = new SchuhService(prismaServiceMock, whereBuilder);
    });

    test('id vorhanden', async () => {
        // given
        const id = 1;
        const schuhMock: SchuhMitModellUndAbbildungen = {
            id,
            version: 0,
            artikelnummer: 'SH001-TEST',
            bewertung: 1,
            typ: Schuhtyp.Sneaker,
            preis: new Prisma.Decimal(1.1),
            rabattsatz: new Prisma.Decimal(0.0123),
            verfuegbar: true,
            erscheinungsdatum: new Date(),
            homepage: 'https://post.rest',
            schlagwoerter: ['SPORT'],
            erstellt_am: new Date(),
            aktualisiert_am: new Date(),
            modell: {
                id: 11,
                modell: 'Adidas NMD',
                farbe: 'core black',
                schuhId: id,
            },
            abbildungen: [],
        };
        (prismaServiceMock.client.schuh.findUnique as any).mockResolvedValueOnce(
            schuhMock,
        );

        // when
        const schuh = await service.findById({ id });

        // then
        expect(schuh).toStrictEqual(schuhMock);
    });

    test('id nicht vorhanden', async () => {
        // given
        const id = 999;
        (prismaServiceMock.client.schuh.findUnique as any).mockResolvedValue(
            null,
        );

        // when / then
        await expect(service.findById({ id })).rejects.toThrow(
            `Es gibt kein Schuh mit der ID ${id}.`,
        );
    });
});
