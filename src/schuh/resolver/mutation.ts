// Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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

// eslint-disable-next-line max-classes-per-file
import { UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { IsInt, IsNumberString, Min } from 'class-validator';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import { SchuhDTO } from '../controller/schuh-dto.js';
import { $Enums } from '../../generated/prisma/client.js';
import {
    SchuhCreate,
    SchuhUpdate,
    SchuhWriteService,
} from '../service/schuh-write-service.js';
import { HttpExceptionFilter } from './http-exception-filter.js';
import { type IdInput } from './query.js';

// Authentifizierung und Autorisierung durch
//  GraphQL Shield
//      https://www.graphql-shield.com
//      https://github.com/maticzav/graphql-shield
//      https://github.com/nestjs/graphql/issues/92
//      https://github.com/maticzav/graphql-shield/issues/213
//  GraphQL AuthZ
//      https://github.com/AstrumU/graphql-authz
//      https://www.the-guild.dev/blog/graphql-authz

export type CreatePayload = {
    readonly id: number;
};

export type UpdatePayload = {
    readonly version: number;
};

export type DeletePayload = {
    readonly success: boolean;
};

export class SchuhUpdateDTO extends SchuhDTO {
    @IsNumberString()
    readonly id!: string;

    @IsInt()
    @Min(0)
    readonly version!: number;
}
@Resolver('Schuh')
// alternativ: globale Aktivierung der Guards https://docs.nestjs.com/security/authorization#basic-rbac-implementation
@UseGuards(AuthGuard)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(ResponseTimeInterceptor)
export class SchuhMutationResolver {
    readonly #service: SchuhWriteService;

    readonly #logger = getLogger(SchuhMutationResolver.name);

    constructor(service: SchuhWriteService) {
        this.#service = service;
    }

    @Mutation()
    @Roles('admin', 'user')
    async create(@Args('input') schuhDTO: SchuhDTO) {
        this.#logger.debug('create: schuhDTO=%o', schuhDTO);

        const schuh = this.#schuhDtoToSchuhCreate(schuhDTO);
        const id = await this.#service.create(schuh);
        this.#logger.debug('createSchuh: id=%d', id);
        const payload: CreatePayload = { id };
        return payload;
    }

    @Mutation()
    @Roles('admin', 'user')
    async update(@Args('input') schuhDTO: SchuhUpdateDTO) {
        this.#logger.debug('update: schuh=%o', schuhDTO);

        const schuh = this.#schuhUpdateDtoToSchuhUpdate(schuhDTO);
        const versionStr = `"${schuhDTO.version.toString()}"`;

        const versionResult = await this.#service.update({
            id: Number.parseInt(schuhDTO.id, 10),
            schuh,
            version: versionStr,
        });
        // TODO BadUserInputError
        this.#logger.debug('updateSchuh: versionResult=%d', versionResult);
        const payload: UpdatePayload = { version: versionResult };
        return payload;
    }

    @Mutation()
    @Roles('admin')
    async delete(@Args() id: IdInput) {
        const idValue = id.id;
        this.#logger.debug('delete: idValue=%s', idValue);
        await this.#service.delete(Number(idValue));
        const payload: DeletePayload = { success: true };
        return payload;
    }

    #schuhDtoToSchuhCreate(schuhDTO: SchuhDTO): SchuhCreate {
        // "Optional Chaining" ab ES2020
        const abbildungen = schuhDTO.abbildungen?.map((abbildungDTO) => {
            const abbildung = {
                beschriftung: abbildungDTO.beschriftung,
                contentType: abbildungDTO.contentType,
            };
            return abbildung;
        });
        const schuh: SchuhCreate = {
            version: 0,
            artikelnummer: schuhDTO.artikelnummer,
            bewertung: schuhDTO.bewertung,
            typ: this.#mapTyp(schuhDTO.typ),
            preis: schuhDTO.preis.toNumber(),
            rabattsatz: schuhDTO.rabattsatz?.toNumber() ?? 0,
            verfuegbar: schuhDTO.verfuegbar ?? false,
            erscheinungsdatum:
                schuhDTO.erscheinungsdatum === undefined
                    ? null
                    : new Date(schuhDTO.erscheinungsdatum),
            homepage: schuhDTO.homepage ?? null,
            schlagwoerter: schuhDTO.schlagwoerter ?? [],
            modell: {
                create: {
                    modell: schuhDTO.modell.modell,
                },
            },
            abbildungen: { create: abbildungen ?? [] },
        };
        return schuh;
    }

    #schuhUpdateDtoToSchuhUpdate(schuhDTO: SchuhUpdateDTO): SchuhUpdate {
        return {
            artikelnummer: schuhDTO.artikelnummer,
            bewertung: schuhDTO.bewertung,
            typ: this.#mapTyp(schuhDTO.typ),
            preis: schuhDTO.preis.toNumber(),
            rabattsatz: schuhDTO.rabattsatz?.toNumber() ?? 0,
            verfuegbar: schuhDTO.verfuegbar ?? false,
            erscheinungsdatum:
                schuhDTO.erscheinungsdatum === undefined
                    ? null
                    : new Date(schuhDTO.erscheinungsdatum),
            homepage: schuhDTO.homepage ?? null,
            schlagwoerter: schuhDTO.schlagwoerter ?? [],
        };
    }

    #mapTyp(typ: string | null | undefined) {
        if (typ === null || typ === undefined) {
            return null;
        }
        switch (typ.toUpperCase()) {
            case 'SNEAKER':
                return $Enums.Schuhtyp.Sneaker;
            case 'LAUFSCHUH':
                return $Enums.Schuhtyp.Laufschuh;
            case 'TENNISSCHUH':
                return $Enums.Schuhtyp.Tennisschuh;
            case 'FREIZEITSCHUH':
                return $Enums.Schuhtyp.Freizeitschuh;
            case 'SKATESCHUH':
                return $Enums.Schuhtyp.Skateschuh;
            default:
                return null;
        }
    }
}
