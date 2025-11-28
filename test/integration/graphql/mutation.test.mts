/* eslint-disable @typescript-eslint/no-non-null-assertion */
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

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import {
    ACCEPT,
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    GRAPHQL_RESPONSE_JSON,
    POST,
    graphqlURL,
} from '../constants.mjs';
import { type GraphQLQuery } from './graphql.mjs';
import { getToken } from './token.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------

type CreateSuccessType = {
    data: { create: { id: string } };
    errors?: undefined;
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
describe('GraphQL Mutations', () => {
    let token: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
    });

    // -------------------------------------------------------------------------
    test('Neues Schuh', async () => {
        // given
        const mutation: GraphQLQuery = {
            query: `
                mutation {
  create(
    input: {
      
      artikelnummer: "978-1-691-95035-7",
      bewertung: 1,
      typ: FREIZEITSCHUH,
      preis: 99.99,
      rabattsatz: 0.123,
      verfuegbar: true,
      erscheinungsdatum: "2024-02-10T00:00:00.000Z",
      homepage: "https://create.mutation",
      schlagwoerter: ["SPORT", "STREETWARE"],
      modell: {
        modell: "Modellcreatemutation"
      },
      abbildungen: [{
        beschriftung: "Abb. 1",
        contentType: "img/png"
      }]
    }
  ) {
      id
  }
}
                
            `,
        };
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(ACCEPT, GRAPHQL_RESPONSE_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(graphqlURL, {
            method: POST,
            body: JSON.stringify(mutation),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(response.headers.get(CONTENT_TYPE)).toMatch(
            /application\/graphql-response\+json/iu,
        );

        const { data, errors } = (await response.json()) as CreateSuccessType;

        expect(errors).toBeUndefined();
        expect(data).toBeDefined();

        const id = data?.create?.id;

        expect(id).toBeDefined( ) ;
        expect(parseInt(id!, 7)).toBeGreaterThan(0);
    });

    // -------------------------------------------------------------------------
    
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
});
/* eslint-enable @typescript-eslint/no-non-null-assertion */
