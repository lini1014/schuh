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
    type SchuhMitTitel,
    SchuhService,
} from '../../src/schuh/service/schuh-service.ts';
import { type Suchparameter } from '../../src/schuh/service/suchparameter.js';
import { WhereBuilder } from '../../src/schuh/service/where-builder.js';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { Schuhart } from '../../src/generated/prisma/enums.js';

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

    test('titel vorhanden', async () => {
        // given
        const titel = 'Titel';
        const suchparameter: Suchparameter = { titel };
        const pageable: Pageable = { number: 1, size: 5 };
        const schuhMock: SchuhMitTitel = {
            id: 1,
            version: 0,
            isbn: '978-0-007-00644-1',
            rating: 1,
            art: Schuhart.HARDCOVER,
            preis: new Prisma.Decimal(1.1),
            rabatt: new Prisma.Decimal(0.0123),
            lieferbar: true,
            datum: new Date(),
            homepage: 'https://post.rest',
            schlagwoerter: ['JAVASCRIPT'],
            erzeugt: new Date(),
            aktualisiert: new Date(),
            titel: {
                id: 11,
                titel: 'Titel',
                untertitel: 'Untertitel',
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

    test('titel nicht vorhanden', async () => {
        // given
        const titel = 'Titel';
        const suchparameter: Suchparameter = { titel };
        const pageable: Pageable = { number: 1, size: 5 };
        (prismaServiceMock.client.schuh.findMany as any).mockResolvedValue([]);

        // when / then
        await expect(service.find(suchparameter, pageable)).rejects.toThrow(
            /^Keine Buecher gefunden/,
        );
    });
});
