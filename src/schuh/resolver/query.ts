import { UseFilters, UseInterceptors } from '@nestjs/common';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import BigNumber from 'bignumber.js'; // eslint-disable-line @typescript-eslint/naming-convention
import { Public } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    SchuhService,
    type SchuhMitModell,
    type SchuhMitModellUndAbbildungen,
} from '../service/schuh-service.js';
import { createPageable } from '../service/pageable.js';
import { HttpExceptionFilter } from './http-exception-filter.js';
import { Slice } from '../service/slice.js';
import { Suchparameter } from '../service/suchparameter.js';

export type IdInput = {
    readonly id: string;
};

export type SuchparameterInput = {
    readonly suchparameter: Omit<Suchparameter, 'verfuegbar'> & {
        verfuegbar: boolean | undefined;
    };
};

@Resolver('Schuh')
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class SchuhQueryResolver {
    readonly #service: SchuhService;

    readonly #logger = getLogger(SchuhQueryResolver.name);

    constructor(service: SchuhService) {
        this.#service = service;
    }

    @Query('schuh')
    @Public()
    async findById(
        @Args() { id }: IdInput,
    ): Promise<Readonly<SchuhMitModellUndAbbildungen>> {
        this.#logger.debug('findById: id=%s', id);

        const schuh: Readonly<SchuhMitModellUndAbbildungen> =
            await this.#service.findById({ id: Number(id) });

        if (this.#logger.isLevelEnabled('debug')) {
            this.#logger.debug(
                'findById: schuh=%s, modell=%s',
                schuh.toString(),
                JSON.stringify(schuh.modell),
            );
        }
        return schuh;
    }

    @Query('schuhe')
    @Public()
    async find(
        @Args() input: SuchparameterInput | undefined,
    ): Promise<SchuhMitModell[]> {
        this.#logger.debug('find: input=%s', JSON.stringify(input));
        const pageable = createPageable({});
        const suchparameter = input?.suchparameter;
        if (suchparameter !== undefined) {
            const { verfuegbar } = suchparameter;
            if (verfuegbar !== undefined) {
                (suchparameter as any).verfuegbar = verfuegbar.toString();
            }
        }
        const schuheSlice: Readonly<Slice<Readonly<SchuhMitModell>>> =
            await this.#service.find(suchparameter as any, pageable);
        this.#logger.debug('find: schuheSlice=%o', schuheSlice);
        return schuheSlice.content;
    }

    @ResolveField('rabattsatz')
    rabattsatz(@Parent() schuh: SchuhMitModell, short: boolean | undefined) {
        if (this.#logger.isLevelEnabled('debug')) {
            this.#logger.debug(
                'rabattsatz: schuh=%s, short=%s',
                schuh.toString(),
                short?.toString() ?? 'undefined',
            );
        }
        const rabattsatz = schuh.rabattsatz ?? BigNumber(0);
        const shortStr = short === undefined || short ? '%' : 'Prozent';
        return `${rabattsatz.toString()} ${shortStr}`;
    }

    @ResolveField('erscheinungsdatum')
    erscheinungsdatum(@Parent() schuh: SchuhMitModell) {
        // Nur das ISO-Datum ohne Zeitanteil zurückgeben
        return schuh.erscheinungsdatum
            ? schuh.erscheinungsdatum.toISOString().slice(0, 10)
            : null;
    }

    @ResolveField('typ')
    typ(@Parent() schuh: SchuhMitModell) {
        const { typ } = schuh;
        if (typ === null || typ === undefined) {
            return null;
        }
        const normalized = typ.toLowerCase();
        switch (normalized) {
            case 'sneaker':
                return 'SNEAKER';
            case 'laufschuh':
                return 'LAUFSCHUH';
            case 'tennisschuh':
                return 'TENNISSCHUH';
            case 'freizeitschuh':
                return 'FREIZEITSCHUH';
            case 'skateschuh':
                return 'SKATESCHUH';
            default:
                return null;
        }
    }
}
