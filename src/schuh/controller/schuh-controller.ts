// eslint-disable-next-line max-classes-per-file
import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    NotFoundException,
    Param,
    ParseIntPipe,
    Query,
    Req,
    Res,
    StreamableFile,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { paths } from '../../config/paths.js';
import type { $Enums } from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import { Public } from 'nest-keycloak-connect';
import { createPageable } from '../service/pageable.js';
import {
    type SchuhMitModell,
    SchuhMitModellUndAbbildungen,
    SchuhService,
} from '../service/schuh-service.js';
import { type Suchparameter } from '../service/suchparameter.js';
import { createPage, Page } from './page.js';

type Schuhtyp = $Enums.Schuhtyp;

/**
 * Klasse für `SchuhGetController`, um Queries in _OpenAPI_ bzw. Swagger zu
 * formulieren. `SchuhController` hat dieselben Properties wie die Basisklasse
 * `Schuh` - allerdings mit dem Unterschied, dass diese Properties beim Ableiten
 * so überschrieben sind, dass sie auch nicht gesetzt bzw. undefined sein
 * dürfen, damit die Queries flexibel formuliert werden können. Deshalb ist auch
 * immer der zusätzliche Typ undefined erforderlich.
 * Außerdem muss noch `string` statt `Date` verwendet werden, weil es in OpenAPI
 * den Typ Date nicht gibt.
 */
export class SchuhQuery implements Suchparameter {
    @ApiProperty({ required: false })
    declare readonly artikelnummer?: string;

    @ApiProperty({ required: false })
    declare readonly bewertung?: number;

    @ApiProperty({ required: false })
    declare readonly typ?: Schuhtyp;

    @ApiProperty({ required: false })
    declare readonly preis?: number;

    @ApiProperty({ required: false })
    declare readonly rabattsatz?: number;

    @ApiProperty({ required: false })
    declare readonly verfuegbar?: boolean;

    @ApiProperty({ required: false })
    declare readonly erscheinungsdatum?: string;

    @ApiProperty({ required: false })
    declare readonly homepage?: string;

    @ApiProperty({ required: false })
    declare readonly vintage?: string;

    @ApiProperty({ required: false })
    declare readonly sport?: string;

    @ApiProperty({ required: false })
    declare readonly streetware?: string;

    @ApiProperty({ required: false })
    declare readonly modell?: string;

    @ApiProperty({ required: false })
    declare size?: string;

    @ApiProperty({ required: false })
    declare page?: string;

    @ApiProperty({ required: false })
    declare only?: 'count';
}

export type CountResult = Record<'count', number>;

/**
 * Die Controller-Klasse für die Verwaltung von Schuhe.
 */
@Controller(paths.rest)
@Public()
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Schuh REST-API')
@ApiBearerAuth()
export class SchuhController {
    readonly #service: SchuhService;

    readonly #logger = getLogger(SchuhController.name);

    // constructor(private readonly service: SchuhService) {}
    constructor(service: SchuhService) {
        this.#service = service;
    }

    /**
     * Ein Schuh wird asynchron anhand seiner ID als Pfadparameter gesucht.
     *
     * Falls es ein solches Schuh gibt und `If-None-Match` im Request-Header
     * auf die aktuelle Version des Schuhes gesetzt war, wird der Statuscode
     * `304` (`Not Modified`) zurückgeliefert. Falls `If-None-Match` nicht
     * gesetzt ist oder eine veraltete Version enthält, wird das gefundene
     * Schuh im Rumpf des Response als JSON-Datensatz mit Atom-Links für HATEOAS
     * und dem Statuscode `200` (`OK`) zurückgeliefert.
     *
     * Falls es kein Schuh zur angegebenen ID gibt, wird der Statuscode `404`
     * (`Not Found`) zurückgeliefert.
     *
     * @param id Pfad-Parameter `id`
     * @param req Request-Objekt von Express mit Pfadparameter, Query-String,
     *            Request-Header und Request-Body.
     * @param version Versionsnummer im Request-Header bei `If-None-Match`
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // eslint-disable-next-line max-params
    @Get(':id')
    @ApiOperation({ summary: 'Suche mit der Schuh-ID' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z.B. "0"',
        required: false,
    })
    @ApiOkResponse({ description: 'Der Schuh wurde gefunden' })
    @ApiNotFoundResponse({ description: 'Kein Schuh zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Der Schuh wurde bereits heruntergeladen',
    })
    async getById(
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<SchuhMitModellUndAbbildungen>> {
        this.#logger.debug('getById: id=%d, version=%s', id, version ?? '-1');

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('getById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const schuh = await this.#service.findById({ id });
        if (this.#logger.isLevelEnabled('debug')) {
            this.#logger.debug('getById(): schuh=%s', schuh.toString());
            this.#logger.debug(
                'getById(): modell=%s',
                JSON.stringify(schuh.modell),
            );
        }

        // ETags
        const versionDb = schuh.version;
        const ifNoneMatch = this.#normalizeIfNoneMatch(version);
        if (ifNoneMatch.includes('*') || ifNoneMatch.includes(`${versionDb}`)) {
            this.#logger.debug('getById: NOT_MODIFIED');
            return res.status(HttpStatus.NOT_MODIFIED).end();
        }
        this.#logger.debug('getById: versionDb=%d', versionDb ?? -1);
        res.header('ETag', `"${versionDb}"`);

        this.#logger.debug('getById: schuh=%o', schuh);
        return res.json(this.#mapErscheinungsdatum(schuh));
    }

    /**
     * Schuhe werden mit Query-Parametern asynchron gesucht. Falls es mindestens
     * ein solches Schuh gibt, wird der Statuscode `200` (`OK`) gesetzt. Im Rumpf
     * des Response ist das JSON-Array mit den gefundenen Schuhen, die jeweils
     * um Atom-Links für HATEOAS ergänzt sind.
     *
     * Falls es kein Schuh zu den Suchparameter gibt, wird der Statuscode `404`
     * (`Not Found`) gesetzt.
     *
     * Falls es keine Query-Parameter gibt, werden alle Schuhe ermittelt.
     *
     * @param query Query-Parameter von Express.
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Get()
    @ApiOperation({ summary: 'Suche mit Suchparameter' })
    @ApiOkResponse({ description: 'Eine evtl. leere Liste mit Schuhen' })
    async get(
        @Query() query: SchuhQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<Page<Readonly<SchuhMitModell>> | CountResult>> {
        this.#logger.debug('get: query=%o', query);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('get: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const { only } = query;
        if (only !== undefined) {
            const count = await this.#service.count();
            this.#logger.debug('get: count=%d', count);
            return res.json({ count: count });
        }

        const { page, size } = query;
        delete query['page'];
        delete query['size'];
        this.#logger.debug(
            'get: page=%s, size=%s',
            page ?? 'undefined',
            size ?? 'undefined',
        );

        const keys = Object.keys(query) as (keyof SchuhQuery)[];
        keys.forEach((key) => {
            if (query[key] === undefined) {
                delete query[key];
            }
        });
        this.#logger.debug('get: query=%o', query);

        const pageable = createPageable({ number: page, size });
        const schuheSlice = await this.#service.find(query, pageable);
        const schuhPage = createPage(schuheSlice, pageable);
        this.#logger.debug('get: schuhPage=%o', schuhPage);

        const content = schuhPage.content.map((schuh) =>
            this.#mapErscheinungsdatum(schuh),
        );
        return res
            .json({
                ...schuhPage,
                content,
            })
            .send();
    }

    /**
     * Zu einem Schuh mit gegebener ID wird die zugehörige Binärdatei, z.B.
     * ein Bild oder ein Video, heruntergeladen.
     *
     * @param idStr Pfad-Parameter `id`.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Get('/file/:id')
    @ApiOperation({ description: 'Suche nach Datei mit der Schuh-ID' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiNotFoundResponse({ description: 'Keine Datei zur Schuh-ID gefunden' })
    @ApiOkResponse({ description: 'Die Datei wurde gefunden' })
    async getFileById(
        @Param('id') idStr: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        this.#logger.debug('getFileById: schuhId:%s', idStr);

        const id = Number(idStr);
        if (!Number.isInteger(id)) {
            this.#logger.debug('getById: not isInteger()');
            throw new NotFoundException(`Die Schuh-ID ${idStr} ist ungueltig.`);
        }

        const schuhFile = await this.#service.findFileBySchuhId(id);
        if (schuhFile?.data === undefined) {
            throw new NotFoundException('Keine Datei gefunden.');
        }

        res.contentType(schuhFile.mimetype ?? 'image/png').set({
            'Content-Disposition': `inline; filename="${schuhFile.filename}"`, // eslint-disable-line @typescript-eslint/naming-convention
        });
        return new StreamableFile(schuhFile.data);
    }

    #normalizeIfNoneMatch(versionHeader: string | undefined) {
        if (versionHeader === undefined) {
            return [];
        }
        const tags = versionHeader.split(',');
        return tags
            .map((etag) => etag.trim())
            .map((etag) => (etag.startsWith('W/') ? etag.slice(2) : etag))
            .map((etag) =>
                etag.startsWith('"') && etag.endsWith('"')
                    ? etag.slice(1, -1)
                    : etag,
            );
    }

    #mapErscheinungsdatum<
        T extends { erscheinungsdatum?: Date | string | null },
    >(schuh: T): T & { erscheinungsdatum: string | null } {
        const date = schuh.erscheinungsdatum;
        const erscheinungsdatum =
            date instanceof Date
                ? date.toISOString().slice(0, 10)
                : (date ?? null);
        return { ...schuh, erscheinungsdatum };
    }
}
