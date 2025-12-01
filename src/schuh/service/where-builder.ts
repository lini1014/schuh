/**
 * Das Modul besteht aus der Klasse {@linkcode WhereBuilder}.
 * @packageDocumentation
 */

import { Injectable } from '@nestjs/common';
import * as PrismaModule from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import { type Suchparameter } from './suchparameter.js';

const { Prisma, $Enums } = PrismaModule;
type Schuhtyp = PrismaModule.$Enums.Schuhtyp;
type SchuhWhereInput = PrismaModule.Prisma.SchuhWhereInput;

/** Typdefinitionen für die Suche mit der Schuh-ID. */
export type BuildIdParams = {
    /** ID des gesuchten Schuhs. */
    readonly id: number;
    /** Sollen die Abbildungen mitgeladen werden? */
    readonly mitAbbildungen?: boolean;
};
/**
 * Die Klasse `WhereBuilder` baut die WHERE-Klausel für DB-Anfragen mit _Prisma_.
 */
@Injectable()
export class WhereBuilder {
    readonly #logger = getLogger(WhereBuilder.name);

    /**
     * WHERE-Klausel für die flexible Suche nach Büchern bauen.
     * @param suchparameter JSON-Objekt mit Suchparameter. Bei "modell" wird mit
     * einem Teilstring gesucht, bei "bewertung" mit einem Mindestwert, bei "preis"
     * mit der Obergrenze.
     * @returns SchuhWhereInput
     */
    // "rest properties" ab ES 2018 https://github.com/tc39/proposal-object-rest-spread
    // eslint-disable-next-line max-lines-per-function, prettier/prettier, sonarjs/cognitive-complexity
    build({ sport, streetware, vintage, ...restProps }: Suchparameter) {
        this.#logger.debug(
            'build: sport=%s, vintage=%s, streetware=%s, restProps=%o',
            vintage ?? 'undefined',
            streetware ?? 'undefined',
            sport ?? 'undefined',
            restProps,
        );

        // Beispiel:
        // { modell: 'a', bewertung: 4, preis: 22.5, sport: true }
        // WHERE modell ILIKE %a% AND bewertung >= 4 AND preis <= 22.5 AND schlagwoerter @> '["SPORT"]'

        let where: SchuhWhereInput = {};

        // Properties vom Typ number, enum, boolean, Date
        // diverse Vergleiche, z.B. Gleichheit, <= (lte), >= (gte)
        Object.entries(restProps).forEach(([key, value]) => {
            switch (key) {
                case 'modell':
                    where.modell = {
                        modell: {
                            contains: value as string,
                            mode: Prisma.QueryMode.insensitive,
                        },
                    };
                    break;
                case 'artikelnummer':
                    where.artikelnummer = { equals: value as string };
                    break;
                case 'bewertung':
                    const bewertungNumber = parseInt(value as string);
                    if (!isNaN(bewertungNumber)) {
                        where.bewertung = { gte: bewertungNumber };
                    }
                    break;
                case 'preis':
                    const preisNumber = parseInt(value as string);
                    if (!isNaN(preisNumber)) {
                        where.preis = { lte: preisNumber };
                    }
                    break;
                case 'typ':
                    // enum, case-insensitive
                    if (typeof value === 'string') {
                        const mapped = this.#mapTyp(value);
                        if (mapped !== undefined) {
                            where.typ = { equals: mapped };
                        }
                    }
                    break;
                case 'verfuegbar':
                    // boolean
                    where.verfuegbar = {
                        equals: (value as string).toLowerCase() === 'true',
                    };
                    break;
                case 'erscheinungsdatum':
                    where.erscheinungsdatum = {
                        gte: new Date(value as string),
                    };
                    break;
                case 'homepage':
                    where.homepage = { equals: value as string };
                    break;
            }
        });

        const schlagwoerter = this.#buildSchlagwoerter({
            sport,
            vintage,
            streetware,
        });
        if (schlagwoerter.length > 0) {
            // allow case-insensitive matching by checking lower/upper variants
            const tags = new Set(
                schlagwoerter.flatMap((tag) => [
                    tag,
                    tag.toLowerCase(),
                    tag.toUpperCase(),
                ]),
            );
            const tagConditions = Array.from(tags).map((tag) => ({
                schlagwoerter: { array_contains: [tag] },
            }));
            where =
                Object.keys(where).length === 0
                    ? { OR: tagConditions }
                    : {
                          AND: [where, { OR: tagConditions }],
                      };
        }

        this.#logger.debug('build: where=%o', where);
        return where;
    }

    #buildSchlagwoerter({
        sport,
        vintage,
        streetware,
    }: {
        sport: string | undefined;
        vintage: string | undefined;
        streetware: string | undefined;
    }): ReadonlyArray<string> {
        const schlagwoerter: string[] = [];
        if (sport?.toLowerCase() === 'true') {
            schlagwoerter.push('sport');
        }
        if (vintage?.toLowerCase() === 'true') {
            schlagwoerter.push('vintage');
        }
        if (streetware?.toLowerCase() === 'true') {
            // DB-Wert lautet "streetwear"
            schlagwoerter.push('streetwear');
        }
        return schlagwoerter;
    }

    #mapTyp(value: string): Schuhtyp | undefined {
        const normalized = value.toLowerCase();
        switch (normalized) {
            case 'sneaker':
                return $Enums.Schuhtyp.Sneaker;
            case 'laufschuh':
                return $Enums.Schuhtyp.Laufschuh;
            case 'tennisschuh':
                return $Enums.Schuhtyp.Tennisschuh;
            case 'freizeitschuh':
                return $Enums.Schuhtyp.Freizeitschuh;
            case 'skateschuh':
                return $Enums.Schuhtyp.Skateschuh;
            default:
                return undefined;
        }
    }
}
