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

/**
 * Das Modul besteht aus der Klasse {@linkcode SchuhWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import {
    PrismaClient,
    SchuhFile,
    type Prisma,
} from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import { MailService } from '../../mail/mail-service.js';
import {
    IsbnExistsException,
    VersionInvalidException,
    VersionOutdatedException,
} from './exceptions.js';
import { PrismaService } from './prisma-service.js';
import { SchuhService } from './schuh-service.js';

export type SchuhCreate = Prisma.SchuhCreateInput;
type SchuhCreated = Prisma.SchuhGetPayload<{
    include: {
        modell: true;
        abbildungen: true;
    };
}>;

export type SchuhUpdate = Prisma.SchuhUpdateInput;
/** Typdefinitionen zum Aktualisieren eines Schuhes mit `update`. */
export type UpdateParams = {
    /** ID des zu aktualisierenden Schuhes. */
    readonly id: number | undefined;
    /** Schuh-Objekt mit den aktualisierten Werten. */
    readonly schuh: SchuhUpdate;
    /** Versionsnummer für die zu aktualisierenden Werte. */
    readonly version: string;
};
type SchuhUpdated = Prisma.SchuhGetPayload<{}>;

type SchuhFileCreate = Prisma.SchuhFileUncheckedCreateInput;
export type SchuhFileCreated = Prisma.SchuhFileGetPayload<{}>;

/**
 * Die Klasse `SchuhWriteService` implementiert den Anwendungskern für das
 * Schreiben von Bücher und greift mit _Prisma_ auf die DB zu.
 */
@Injectable()
export class SchuhWriteService {
    private static readonly VERSION_PATTERN = /^"\d{1,3}"/u;

    readonly #prisma: PrismaClient;

    readonly #readService: SchuhService;

    readonly #mailService: MailService;

    readonly #logger = getLogger(SchuhWriteService.name);

    // eslint-disable-next-line max-params
    constructor(
        prisma: PrismaService,
        readService: SchuhService,
        mailService: MailService,
    ) {
        this.#prisma = prisma.client;
        this.#readService = readService;
        this.#mailService = mailService;
    }

    /**
     * Ein neues Schuh soll angelegt werden.
     * @param schuh Das neu abzulegende Schuh
     * @returns Die ID des neu angelegten Schuhes
     * @throws IsbnExists falls die artikelnummer bereits existiert
     */
    async create(schuh: SchuhCreate) {
        this.#logger.debug('create: schuh=%o', schuh);
        await this.#validateCreate(schuh);

        // Neuer Datensatz mit generierter ID
        let schuhDb: SchuhCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            schuhDb = await tx.schuh.create({
                data: schuh,
                include: { modell: true, abbildungen: true },
            });
        });
        await this.#sendmail({
            id: schuhDb?.id ?? 'N/A',
            modell: schuhDb?.modell?.modell ?? 'N/A',
        });

        this.#logger.debug('create: schuhDb.id=%s', schuhDb?.id ?? 'N/A');
        return schuhDb?.id ?? NaN;
    }

    /**
     * Zu einem vorhandenen Schuh eine Binärdatei mit z.B. einem Bild abspeichern.
     * @param schuhId ID des vorhandenen Schuhes
     * @param data Bytes der Datei als Buffer Node
     * @param filename Dateiname
     * @param size Dateigröße in Bytes
     * @returns Entity-Objekt für `SchuhFile`
     */
    // eslint-disable-next-line max-params
    async addFile(
        schuhId: number,
        data: Uint8Array<ArrayBufferLike>,
        filename: string,
        size: number,
    ): Promise<Readonly<SchuhFile> | undefined> {
        this.#logger.debug(
            'addFile: schuhId=%d, filename=%s, size=%d',
            schuhId,
            filename,
            size,
        );

        // TODO Dateigroesse pruefen

        let schuhFileCreated: SchuhFileCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            // Schuh ermitteln, falls vorhanden
            const schuh = tx.schuh.findUnique({
                where: { id: schuhId },
            });
            if (schuh === null) {
                this.#logger.debug('Es gibt kein Schuh mit der ID %d', schuhId);
                throw new NotFoundException(
                    `Es gibt kein Schuh mit der ID ${schuhId}.`,
                );
            }

            // evtl. vorhandene Datei löschen
            await tx.schuhFile.deleteMany({ where: { schuhId } });

            const fileType = await fileTypeFromBuffer(data);
            const mimetype = fileType?.mime ?? null;
            this.#logger.debug('addFile: mimetype=%s', mimetype ?? 'undefined');

            const schuhFile: SchuhFileCreate = {
                filename,
                data,
                mimetype,
                schuhId,
            };
            schuhFileCreated = await tx.schuhFile.create({ data: schuhFile });
        });

        this.#logger.debug(
            'addFile: id=%d, byteLength=%d, filename=%s, mimetype=%s',
            schuhFileCreated?.id ?? NaN,
            schuhFileCreated?.data.byteLength ?? NaN,
            schuhFileCreated?.filename ?? 'undefined',
            schuhFileCreated?.mimetype ?? 'null',
        );
        return schuhFileCreated;
    }

    /**
     * Ein vorhandenes Schuh soll aktualisiert werden. "Destructured" Argument
     * mit id (ID des zu aktualisierenden Schuhs), schuh (zu aktualisierendes Schuh)
     * und version (Versionsnummer für optimistische Synchronisation).
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     * @throws NotFoundException falls kein Schuh zur ID vorhanden ist
     * @throws VersionInvalidException falls die Versionsnummer ungültig ist
     * @throws VersionOutdatedException falls die Versionsnummer veraltet ist
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async update({ id, schuh, version }: UpdateParams) {
        this.#logger.debug(
            'update: id=%d, schuh=%o, version=%s',
            id ?? NaN,
            schuh,
            version,
        );
        if (id === undefined) {
            this.#logger.debug('update: Keine gueltige ID');
            throw new NotFoundException(`Es gibt kein Schuh mit der ID ${id}.`);
        }

        await this.#validateUpdate(id, version);

        schuh.version = { increment: 1 };
        let schuhUpdated: SchuhUpdated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            schuhUpdated = await tx.schuh.update({
                data: schuh,
                where: { id },
            });
        });
        this.#logger.debug(
            'update: schuhUpdated=%s',
            JSON.stringify(schuhUpdated),
        );

        return schuhUpdated?.version ?? NaN;
    }

    /**
     * Ein Schuh wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Schuhes
     * @returns true, falls das Schuh vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: number) {
        this.#logger.debug('delete: id=%d', id);

        await this.#prisma.$transaction(async (tx) => {
            await tx.schuh.delete({ where: { id } });
        });

        this.#logger.debug('delete');
    }

    async #validateCreate({
        artikelnummer,
    }: Prisma.SchuhCreateInput): Promise<undefined> {
        this.#logger.debug(
            '#validateCreate: artikelnummer=%s',
            artikelnummer ?? 'undefined',
        );
        if (artikelnummer === undefined) {
            this.#logger.debug('#validateCreate: ok');
            return;
        }

        const anzahl = await this.#prisma.schuh.count({
            where: { artikelnummer },
        });
        if (anzahl > 0) {
            this.#logger.debug(
                '#validateCreate: artikelnummer existiert: %s',
                artikelnummer,
            );
            throw new IsbnExistsException(artikelnummer);
        }
        this.#logger.debug('#validateCreate: ok');
    }

    async #sendmail({ id, modell }: { id: number | 'N/A'; modell: string }) {
        const subject = `Neues Schuh ${id}`;
        const body = `Das Schuh mit dem Modell <strong>${modell}</strong> ist angelegt`;
        await this.#mailService.sendmail({ subject, body });
    }

    async #validateUpdate(id: number, versionStr: string) {
        this.#logger.debug(
            '#validateUpdate: id=%d, versionStr=%s',
            id,
            versionStr,
        );
        if (!SchuhWriteService.VERSION_PATTERN.test(versionStr)) {
            throw new VersionInvalidException(versionStr);
        }

        const version = Number.parseInt(versionStr.slice(1, -1), 10);
        const schuhDb = await this.#readService.findById({ id });

        if (version < schuhDb.version) {
            this.#logger.debug('#validateUpdate: versionDb=%d', version);
            throw new VersionOutdatedException(version);
        }
    }
}
