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
import { PrismaService } from '../../src/buch/service/prisma-service.js';
import { SchuhService } from '../../src/buch/service/schuh-service.ts';
import {
    type SchuhCreate,
    SchuhWriteService,
} from '../../src/buch/service/schuh-write-service.ts';
import { WhereBuilder } from '../../src/buch/service/where-builder.js';
import { Prisma, PrismaClient } from '../../src/generated/prisma/client.js';
import { Schuhart } from '../../src/generated/prisma/enums.js';
import { MailService } from '../../src/mail/mail-service.js';

describe('SchuhWriteService create', () => {
    let service: SchuhWriteService;
    let prismaServiceMock: PrismaService;
    let readService: SchuhService;
    let mailService: MailService;
    let buchCreateMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        buchCreateMock = vi.fn<any>();
        const transactionMock = vi
            .fn<any>()
            .mockImplementation(async (cb: any) => {
                // Mock-Objekt für die Transaktion
                const tx = {
                    buch: { create: buchCreateMock },
                };
                // Callback mit dem Mock-Objekt fuer die Transaktion aufrufen
                await cb(tx);
            });

        const countMock = vi.fn<PrismaClient['buch']['count']>();

        prismaServiceMock = {
            client: {
                $transaction: transactionMock,
                buch: {
                    count: countMock,
                },
            } as unknown,
        } as PrismaService;

        const whereBuilder = new WhereBuilder();

        readService = new SchuhService(prismaServiceMock, whereBuilder);

        // TODO Mocking der Funktion sendMail()
        mailService = new MailService();

        service = new SchuhWriteService(
            prismaServiceMock,
            readService,
            mailService,
        );
    });

    test('Neues Schuh', async () => {
        // given
        const idMock = 1;
        const buch: SchuhCreate = {
            isbn: '978-0-007-00644-1',
            rating: 1,
            art: Schuhart.HARDCOVER,
            preis: new Prisma.Decimal(1.1),
            rabatt: new Prisma.Decimal(0.0123),
            lieferbar: true,
            datum: new Date(),
            homepage: 'https://post.rest',
            schlagwoerter: ['JAVASCRIPT'],
            titel: {
                create: {
                    titel: 'Modell',
                    untertitel: 'Untertitel',
                },
            },
        };
        const buchMockTemp: any = { ...buch };
        buchMockTemp.id = idMock;
        buchMockTemp.titel.create.id = 11;
        buchMockTemp.titel.create.buchId = idMock;
        buchCreateMock.mockResolvedValue(buchMockTemp);

        // when
        const id = await service.create(buch);

        // then
        expect(id).toBe(idMock);
    });
});
