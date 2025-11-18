/**
 * Das Modul besteht aus der Klasse {@linkcode SchuhService}.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
    Prisma,
    PrismaClient,
    SchuhFile,
} from '../../generated/prisma/client.js';
import { type SchuhInclude } from '../../generated/prisma/models/Schuh.js';
import { getLogger } from '../../logger/logger.js';
import { type Pageable } from './pageable.js';
import { PrismaService } from './prisma-service.js';
import { type Slice } from './slice.js';
import { type Suchparameter, suchparameterNamen } from './suchparameter.js';
import { WhereBuilder } from './where-builder.js';

// Typdefinition für `findById`
type FindByIdParams = {
    // ID des gesuchten Schuhs
    readonly id: number;
    /** Sollen die Abbildungen mitgeladen werden? */
    readonly mitAbbildungen?: boolean;
};

export type SchuhMitModell = Prisma.SchuhGetPayload<{
    include: { modell: true };
}>;

export type SchuhMitModellUndAbbildungen = Prisma.SchuhGetPayload<{
    include: {
        modell: true;
        abbildungen: true;
    };
}>;

/**
 * Die Klasse `SchuhService` implementiert das Lesen für Schuhe und greift
 * mit _Prisma_ auf eine relationale DB zu.
 */
@Injectable()
export class SchuhService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #prisma: PrismaClient;
    readonly #whereBuilder: WhereBuilder;
    readonly #includeModell: SchuhInclude = { modell: true };
    readonly #includeModellUndAbbildungen: SchuhInclude = {
        modell: true,
        abbildungen: true,
    };

    readonly #logger = getLogger(SchuhService.name);

    constructor(prisma: PrismaService, whereBuilder: WhereBuilder) {
        this.#prisma = prisma.client;
        this.#whereBuilder = whereBuilder;
    }

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C#
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Ein Schuh asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Schuhes
     * @returns Das gefundene Schuh in einem Promise aus ES2015.
     * @throws NotFoundException falls kein Schuh mit der ID existiert
     */
    async findById({
        id,
        mitAbbildungen = false,
    }: FindByIdParams): Promise<Readonly<SchuhMitModellUndAbbildungen>> {
        this.#logger.debug('findById: id=%d', id);

        // Das Resultat ist null, falls kein Datensatz gefunden
        // Lesen: Keine Transaktion erforderlich
        const include = mitAbbildungen
            ? this.#includeModellUndAbbildungen
            : this.#includeModell;
        const schuh: SchuhMitModellUndAbbildungen | null =
            await this.#prisma.schuh.findUnique({
                where: { id },
                include,
            });
        if (schuh === null) {
            this.#logger.debug('Es gibt kein Schuh mit der ID %d', id);
            throw new NotFoundException(`Es gibt kein Schuh mit der ID ${id}.`);
        }
        if (schuh.schlagwoerter === null) {
            schuh.schlagwoerter = [];
        }

        this.#logger.debug('findById: schuh=%o', schuh);
        return schuh;
    }

    /**
     * Binärdatei zu einem Schuh suchen.
     * @param schuhId ID des zugehörigen Schuhs.
     * @returns Binärdatei oder undefined als Promise.
     */
    async findFileBySchuhId(
        schuhId: number,
    ): Promise<Readonly<SchuhFile> | undefined> {
        this.#logger.debug('findFileBySchuhId: schuhId=%d', schuhId);
        const schuhFile: SchuhFile | null =
            await this.#prisma.schuhFile.findUnique({ where: { schuhId } });
        if (schuhFile === null) {
            this.#logger.debug('findFileBySchuhId: Keine Datei gefunden');
            return;
        }

        this.#logger.debug(
            'findFileBySchuhId: id=%s, byteLength=%d, filename=%s, mimetype=%s, schuhId=%d',
            schuhFile.id,
            schuhFile.data.byteLength,
            schuhFile.filename,
            schuhFile.mimetype ?? 'undefined',
            schuhFile.schuhId,
        );

        // als Datei im Wurzelverzeichnis des Projekts speichern:
        // import { writeFile } from 'node:fs/promises';
        // await writeFile(schuhFile.filename, schuhFile.data);

        return schuhFile;
    }

    /**
     * Schuhe asynchron suchen.
     * @param suchparameter JSON-Objekt mit Suchparameter.
     * @param pageable Maximale Anzahl an Datensätzen und Seitennummer.
     * @returns Ein JSON-Array mit den gefundenen Schuhen.
     * @throws NotFoundException falls keine Schuhe gefunden wurden.
     */
    async find(
        suchparameter: Suchparameter | undefined,
        pageable: Pageable,
    ): Promise<Readonly<Slice<Readonly<SchuhMitModell>>>> {
        this.#logger.debug(
            'find: suchparameter=%s, pageable=%o',
            JSON.stringify(suchparameter),
            pageable,
        );

        // Keine Suchparameter?
        if (suchparameter === undefined) {
            return await this.#findAll(pageable);
        }
        const keys = Object.keys(suchparameter);
        if (keys.length === 0) {
            return await this.#findAll(pageable);
        }

        // Falsche Namen fuer Suchparameter?
        if (!this.#checkKeys(keys) || !this.#checkEnums(suchparameter)) {
            this.#logger.debug('Ungueltige Suchparameter');
            throw new NotFoundException('Ungueltige Suchparameter');
        }

        // Das Resultat ist eine leere Liste, falls nichts gefunden
        // Lesen: Keine Transaktion erforderlich
        const where = this.#whereBuilder.build(suchparameter);
        const { number, size } = pageable;
        const schuhe: SchuhMitModell[] = await this.#prisma.schuh.findMany({
            where,
            skip: number * size,
            take: size,
            include: this.#includeModell,
        });
        if (schuhe.length === 0) {
            this.#logger.debug('find: Keine Schuhe gefunden');
            throw new NotFoundException(
                `Keine Schuhe gefunden: ${JSON.stringify(suchparameter)}, Seite ${pageable.number}}`,
            );
        }
        const totalElements = await this.count();
        return this.#createSlice(schuhe, totalElements);
    }

    /**
     * Anzahl aller Schuhe zurückliefern.
     * @returns Ein JSON-Array mit den gefundenen Schuhen.
     */
    async count() {
        this.#logger.debug('count');
        const count = await this.#prisma.schuh.count();
        this.#logger.debug('count: %d', count);
        return count;
    }

    async #findAll(
        pageable: Pageable,
    ): Promise<Readonly<Slice<SchuhMitModell>>> {
        const { number, size } = pageable;
        const schuhe: SchuhMitModell[] = await this.#prisma.schuh.findMany({
            skip: number * size,
            take: size,
            include: this.#includeModell,
        });
        if (schuhe.length === 0) {
            this.#logger.debug('#findAll: Keine Schuhe gefunden');
            throw new NotFoundException(`Ungueltige Seite "${number}"`);
        }
        const totalElements = await this.count();
        return this.#createSlice(schuhe, totalElements);
    }

    #createSlice(
        schuhe: SchuhMitModell[],
        totalElements: number,
    ): Readonly<Slice<SchuhMitModell>> {
        schuhe.forEach((schuh) => {
            if (schuh.schlagwoerter === null) {
                schuh.schlagwoerter = [];
            }
        });
        const schuhSlice: Slice<SchuhMitModell> = {
            content: schuhe,
            totalElements,
        };
        this.#logger.debug('createSlice: schuhSlice=%o', schuhSlice);
        return schuhSlice;
    }

    #checkKeys(keys: string[]) {
        this.#logger.debug('#checkKeys: keys=%o', keys);
        // Ist jeder Suchparameter auch eine Property von Schuh oder "schlagwoerter"?
        let validKeys = true;
        keys.forEach((key) => {
            if (
                !suchparameterNamen.includes(key) &&
                key !== 'vintage' &&
                key !== 'streetware' &&
                key !== 'sport'
            ) {
                this.#logger.debug(
                    '#checkKeys: ungueltiger Suchparameter "%s"',
                    key,
                );
                validKeys = false;
            }
        });

        return validKeys;
    }

    #checkEnums(suchparameter: Suchparameter) {
        const { typ } = suchparameter;
        this.#logger.debug(
            '#checkEnums: Suchparameter "typ=%s"',
            typ ?? 'undefined',
        );
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return (
            typ === undefined ||
            typ === 'Sneaker' ||
            typ === 'Laufschuh' ||
            typ === 'Tennisschuh' ||
            typ === 'Freizeitschuh' ||
            typ === 'Skateschuh'
        );
    }
}
