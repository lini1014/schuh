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
    type SchuhMitTitel,
    SchuhService,
} from '../../src/schuh/service/schuh-service.ts';
import { WhereBuilder } from '../../src/schuh/service/where-builder.js';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { Schuhart } from '../../src/generated/prisma/enums.js';

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
        const schuhMock: SchuhMitTitel = {
            id,
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
                schuhId: id,
            },
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
