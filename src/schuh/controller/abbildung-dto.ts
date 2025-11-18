/* eslint-disable @typescript-eslint/no-magic-numbers */

import { ApiProperty } from '@nestjs/swagger';
import { MaxLength } from 'class-validator';

/**
 * Entity-Klasse für Abbildung.
 */
export class AbbildungDTO {
    @MaxLength(32)
    @ApiProperty({ example: 'Die Beschriftung', type: String })
    readonly beschriftung!: string;

    @MaxLength(16)
    @ApiProperty({ example: 'image/png', type: String })
    readonly contentType!: string;
}
/* eslint-enable @typescript-eslint/no-magic-numbers */
