import { Module } from '@nestjs/common';
import { MailModule } from '../mail/module.js';
import { KeycloakModule } from '../security/keycloak/module.js';
import { SchuhController } from './controller/schuh-controller.js';
import { SchuhWriteController } from './controller/schuh-write-controller.js';
import { SchuhMutationResolver } from './resolver/mutation.js';
import { SchuhQueryResolver } from './resolver/query.js';
import { PrismaService } from './service/prisma-service.js';
import { SchuhService } from './service/schuh-service.js';
import { SchuhWriteService } from './service/schuh-write-service.js';
import { WhereBuilder } from './service/where-builder.js';

/**
 * Das Modul besteht aus Controller- und Service-Klassen für die Verwaltung von
 * Bücher.
 * @packageDocumentation
 */

/**
 * Die dekorierte Modul-Klasse mit Controller- und Service-Klassen sowie der
 * Funktionalität für Prisma.
 */
@Module({
    imports: [KeycloakModule, MailModule],
    controllers: [SchuhController, SchuhWriteController],
    // Provider sind z.B. Service-Klassen fuer DI
    providers: [
        SchuhService,
        SchuhWriteService,
        SchuhQueryResolver,
        SchuhMutationResolver,
        PrismaService,
        WhereBuilder,
    ],
    // Export der Provider fuer DI in anderen Modulen
    exports: [SchuhService, SchuhWriteService],
})
export class SchuhModule {}
