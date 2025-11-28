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
import { type Pageable } from '../../src/schuh/service/pageable.js';
import { PrismaService } from '../../src/schuh/service/prisma-service.js';
import {
    type SchuhMitModell,
    SchuhService,
} from '../../src/schuh/service/schuh-service.js';
import { type Suchparameter } from '../../src/schuh/service/suchparameter.js';
import { WhereBuilder } from '../../src/schuh/service/where-builder.js';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { Schuhtyp } from '../../src/generated/prisma/enums.js';

describe('SchuhService find', () => {
    let service: SchuhService;
    let prismaServiceMock: PrismaService;

    beforeEach(() => {
        const findManyMock = vi.fn<PrismaClient['schuh']['findMany']>();
        const countMock = vi.fn<PrismaClient['schuh']['count']>();
        prismaServiceMock = {
            client: {
                schuh: {
                    findMany: findManyMock,
                    count: countMock,
                },
            },
        } as any; // cast since we don’t need the full PrismaService here

        const whereBuilder = new WhereBuilder();

        service = new SchuhService(prismaServiceMock, whereBuilder);
    });

    test('Modell vorhanden', async () => {
        // given
        const modell = 'Adidas';
        const suchparameter: Suchparameter = { modell };
        const pageable: Pageable = { number: 1, size: 5 };
        const schuhMock: SchuhMitModell = {
            id: 1,
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
                schuhId: 1,
            },
        };
        (prismaServiceMock.client.schuh.findMany as any).mockResolvedValueOnce([
            schuhMock,
        ]);
        (prismaServiceMock.client.schuh.count as any).mockResolvedValueOnce(1);

        // when
        const result = await service.find(suchparameter, pageable);

        // then
        const { content } = result;

        expect(content).toHaveLength(1);
        expect(content[0]).toStrictEqual(schuhMock);
    });

    test('Modell nicht vorhanden', async () => {
        // given
        const modell = 'Titel';
        const suchparameter: Suchparameter = { modell };
        const pageable: Pageable = { number: 1, size: 5 };
        (prismaServiceMock.client.schuh.findMany as any).mockResolvedValue([]);

        // when / then
        await expect(service.find(suchparameter, pageable)).rejects.toThrow(
            /^Keine Schuhe gefunden/,
        );
    });
});
