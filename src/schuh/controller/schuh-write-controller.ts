/**
 * Das Modul besteht aus der Controller-Klasse für Schreiben an der REST-Schnittstelle.
 * @packageDocumentation
 */

import {
    Body,
    Controller,
    Delete,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Req,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { type MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiForbiddenResponse,
    ApiHeader,
    ApiNoContentResponse,
    ApiOperation,
    ApiParam,
    ApiPreconditionFailedResponse,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { AuthGuard, Roles } from 'nest-keycloak-connect';
import { paths } from '../../config/paths.js';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import {
    SchuhCreate,
    type SchuhFileCreated,
    SchuhUpdate,
    SchuhWriteService,
} from '../service/schuh-write-service.js';
import { createBaseUri } from './create-base-uri.js';
import { InvalidMimeTypeException } from './exceptions.js';
import { SchuhDTO, SchuhDtoOhneRef } from './schuh-dto.js';

const MSG_FORBIDDEN = 'Kein Token mit ausreichender Berechtigung vorhanden';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'video/mp4',
    'video/webm',
    'video/quicktime',
];
const MULTER_OPTIONS: MulterOptions = {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_: any, file: any, cb: any) => {
        if (!MIME_TYPES.includes(file.mimetype)) {
            return cb(new InvalidMimeTypeException(file.mimetype), false);
        }
        cb(null, true);
    },
};

/**
 * Die Controller-Klasse für die Verwaltung von Schuhe.
 */
@Controller(paths.rest)
@UseGuards(AuthGuard)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Schuh REST-API')
@ApiBearerAuth()
export class SchuhWriteController {
    readonly #service: SchuhWriteService;

    readonly #logger = getLogger(SchuhWriteController.name);

    constructor(service: SchuhWriteService) {
        this.#service = service;
    }

    /**
     * Ein neues Schuh wird asynchron angelegt. Das neu anzulegende Schuh ist als
     * JSON-Datensatz im Request-Objekt enthalten. Wenn es keine
     * Verletzungen von Constraints gibt, wird der Statuscode `201` (`Created`)
     * gesetzt und im Response-Header wird `Location` auf die URI so gesetzt,
     * dass damit das neu angelegte Schuh abgerufen werden kann.
     *
     * Falls Constraints verletzt sind, wird der Statuscode `400` (`Bad Request`)
     * gesetzt und genauso auch wenn der Modell oder die ISBN-Nummer bereits
     * existieren.
     *
     * @param schuhDTO JSON-Daten für ein Schuh im Request-Body.
     * @param req Request-Objekt von Express für den Location-Header.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Post()
    @Roles('admin', 'user')
    @ApiOperation({ summary: 'Ein neuer Schuh anlegen' })
    @ApiCreatedResponse({ description: 'Erfolgreich neu angelegt' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Schuhdaten' })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async post(
        @Body() schuhDTO: SchuhDTO,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response> {
        this.#logger.debug('post: schuhDTO=%o', schuhDTO);

        const schuh = this.#schuhDtoToSchuhCreateInput(schuhDTO);
        const id = await this.#service.create(schuh);

        const location = `${createBaseUri(req)}/${id}`;
        this.#logger.debug('post: location=%s', location);
        return res.location(location).send();
    }

    /**
     * Zu einem gegebenen Schuh wird eine Binärdatei, z.B. ein Bild, hochgeladen.
     * Nest realisiert File-Upload mit POST.
     * https://docs.nestjs.com/techniques/file-upload.
     * Postman: Body mit "form-data", key: "file" und "File" im Dropdown-Menü
     * @param id ID des vorhandenen Schuhes
     * @param file Binärdatei als `File`-Objekt von _Multer_.
     * @param req Request-Objekt von Express für den Location-Header.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // eslint-disable-next-line max-params
    @Post(':id')
    @Roles('admin', 'user')
    @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS))
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Binärdatei mit einem Bild hochladen' })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 1',
    })
    @ApiCreatedResponse({ description: 'Erfolgreich hinzugefügt' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Datei' })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async addFile(
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @UploadedFile() file: Express.Multer.File,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response> {
        const { buffer, originalname, size } = file;
        this.#logger.debug(
            'addFile: id: %d, originalname=%s, size=%d, options=%o',
            id,
            originalname,
            size,
            MULTER_OPTIONS,
        );

        const schuhFile: SchuhFileCreated | undefined =
            await this.#service.addFile(id, buffer, originalname, size);
        this.#logger.debug(
            'addFile: id=%d, byteLength=%d, filename=%s, mimetype=%s',
            schuhFile?.id ?? -1,
            schuhFile?.data.byteLength ?? -1,
            schuhFile?.filename ?? 'undefined',
            schuhFile?.mimetype ?? 'null',
        );

        const location = `${createBaseUri(req)}/file/${id}`;
        this.#logger.debug('addFile: location=%s', location);
        return res.location(location).send();
    }

    /**
     * Ein vorhandener Schuh wird asynchron aktualisiert.
     *
     * Im Request-Objekt von Express muss die ID des zu aktualisierenden Schuhes
     * als Pfad-Parameter enthalten sein. Außerdem muss im Rumpf das zu
     * aktualisierende Schuh als JSON-Datensatz enthalten sein. Damit die
     * Aktualisierung überhaupt durchgeführt werden kann, muss im Header
     * `If-Match` auf die korrekte Version für optimistische Synchronisation
     * gesetzt sein.
     *
     * Bei erfolgreicher Aktualisierung wird der Statuscode `204` (`No Content`)
     * gesetzt und im Header auch `ETag` mit der neuen Version mitgeliefert.
     *
     * Falls die Versionsnummer fehlt, wird der Statuscode `428` (`Precondition
     * required`) gesetzt; und falls sie nicht korrekt ist, der Statuscode `412`
     * (`Precondition failed`). Falls Constraints verletzt sind, wird der
     * Statuscode `400` (`Bad Request`) gesetzt und genauso auch wenn der neue
     * Modell oder die neue ISBN-Nummer bereits existieren.
     *
     * @param schuhDTO Schuhdaten im Body des Request-Objekts.
     * @param id Pfad-Paramater für die ID.
     * @param version Versionsnummer aus dem Header _If-Match_.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // eslint-disable-next-line max-params
    @Put(':id')
    @Roles('admin', 'user')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Ein vorhandener Schuh aktualisieren' })
    @ApiHeader({
        name: 'If-Match',
        description: 'Header für optimistische Synchronisation',
        required: false,
    })
    @ApiNoContentResponse({ description: 'Erfolgreich aktualisiert' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Schuhdaten' })
    @ApiPreconditionFailedResponse({
        description: 'Falsche Version im Header "If-Match"',
    })
    @ApiResponse({
        status: HttpStatus.PRECONDITION_REQUIRED,
        description: 'Header "If-Match" fehlt',
    })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async put(
        @Body() schuhDTO: SchuhDtoOhneRef,
        @Param(
            'id',
            new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }),
        )
        id: number,
        @Headers('If-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response> {
        this.#logger.debug(
            'put: id=%d, schuhDTO=%o, version=%s',
            id,
            schuhDTO,
            version ?? 'undefined',
        );

        if (version === undefined) {
            const msg = 'Header "If-Match" fehlt';
            this.#logger.debug('put: msg=%s', msg);
            return res
                .status(HttpStatus.PRECONDITION_REQUIRED)
                .set('Content-Type', 'application/json')
                .send(msg);
        }

        const schuh = this.#schuhDtoToSchuhUpdate(schuhDTO);
        const neueVersion = await this.#service.update({ id, schuh, version });
        this.#logger.debug('put: version=%d', neueVersion);
        return res.header('ETag', `"${neueVersion}"`).send();
    }

    /**
     * Ein Schuh wird anhand seiner ID-gelöscht, die als Pfad-Parameter angegeben
     * ist. Der zurückgelieferte Statuscode ist `204` (`No Content`).
     *
     * @param id Pfad-Paramater für die ID.
     * @returns Leeres Promise-Objekt.
     */
    @Delete(':id')
    @Roles('admin')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Schuh mit der ID löschen' })
    @ApiNoContentResponse({
        description: 'Der Schuh wurde gelöscht oder war nicht vorhanden',
    })
    @ApiForbiddenResponse({ description: MSG_FORBIDDEN })
    async delete(@Param('id') id: number) {
        this.#logger.debug('delete: id=%d', id);
        await this.#service.delete(id);
    }

    #schuhDtoToSchuhCreateInput(schuhDTO: SchuhDTO): SchuhCreate {
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
            typ: schuhDTO.typ ?? null,
            preis: schuhDTO.preis.toNumber(),
            rabattsatz: schuhDTO.rabattsatz?.toNumber() ?? 0,
            verfuegbar: schuhDTO.verfuegbar ?? false,
            erscheinungsdatum: schuhDTO.erscheinungsdatum ?? null,
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

    #schuhDtoToSchuhUpdate(schuhDTO: SchuhDtoOhneRef): SchuhUpdate {
        return {
            version: 0,
            artikelnummer: schuhDTO.artikelnummer,
            bewertung: schuhDTO.bewertung,
            typ: schuhDTO.typ ?? null,
            preis: schuhDTO.preis.toNumber(),
            rabattsatz: schuhDTO.rabattsatz?.toNumber() ?? 0,
            verfuegbar: schuhDTO.verfuegbar ?? false,
            erscheinungsdatum: schuhDTO.erscheinungsdatum ?? null,
            homepage: schuhDTO.homepage ?? null,
            schlagwoerter: schuhDTO.schlagwoerter ?? [],
        };
    }
}
/* eslint-enable max-lines */
