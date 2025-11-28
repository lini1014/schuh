/**
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

/* eslint-disable max-classes-per-file, @typescript-eslint/no-magic-numbers */

import { ApiProperty } from '@nestjs/swagger';
import BigNumber from 'bignumber.js';
import { Transform, Type } from 'class-transformer';
import {
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsISO8601,
    IsInt,
    IsOptional,
    IsUrl,
    Matches,
    Max,
    Min,
    Validate,
    ValidateNested,
    type ValidationArguments,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from 'class-validator';
import type { $Enums } from '../../generated/prisma/client.js';
import { AbbildungDTO } from './abbildung-dto.js';
import { ModellDTO } from './modell-dto.js';

type Schuhtyp = $Enums.Schuhtyp;

export const MAX_BEWERTUNG = 5;

const number2Decimal = ({ value }: { value: BigNumber.Value | undefined }) => {
    if (value === undefined) {
        return;
    }

    BigNumber.set({ DECIMAL_PLACES: 6 });
    return BigNumber(value);
};

const number2Percent = ({ value }: { value: BigNumber.Value | undefined }) => {
    if (value === undefined) {
        return;
    }

    BigNumber.set({ DECIMAL_PLACES: 4 });
    return BigNumber(value);
};

@ValidatorConstraint({ name: 'decimalMin', async: false })
class DecimalMin implements ValidatorConstraintInterface {
    validate(value: BigNumber | undefined, args: ValidationArguments) {
        if (value === undefined) {
            return true;
        }
        const [minValue]: BigNumber[] = args.constraints; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        return value.isGreaterThan(minValue!);
    }

    defaultMessage(args: ValidationArguments) {
        return `Der Wert muss groesser oder gleich ${(args.constraints[0] as BigNumber).toNumber()} sein.`;
    }
}

@ValidatorConstraint({ name: 'decimalMax', async: false })
class DecimalMax implements ValidatorConstraintInterface {
    validate(value: BigNumber | undefined, args: ValidationArguments) {
        if (value === undefined) {
            return true;
        }
        const [maxValue]: BigNumber[] = args.constraints; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        return value.isLessThan(maxValue!);
    }

    defaultMessage(args: ValidationArguments) {
        return `Der Wert muss kleiner oder gleich ${(args.constraints[0] as BigNumber).toNumber()} sein.`;
    }
}

/**
 * Entity-Klasse für Schuhe ohne Referenzen.
 */
export class SchuhDtoOhneRef {
    // https://www.oreilly.com/library/view/regular-expressions-cookbook/9781449327453/ch04s13.html
    @ApiProperty({ example: 'SH005-RECL', type: String })
    readonly artikelnummer!: string;

    @IsInt()
    @Min(0)
    @Max(MAX_BEWERTUNG)
    @ApiProperty({ example: 5, type: Number })
    readonly bewertung!: number;

    @Matches(/^(sneaker|laufschuh|tennisschuh|skateschuh|freizeitschuh)$/iu)
    @IsOptional()
    @ApiProperty({ example: 'VINTAGE', type: String })
    readonly typ: Schuhtyp | undefined;

    @Transform(number2Decimal)
    @Validate(DecimalMin, [BigNumber(0)], {
        message: 'preis muss positiv sein.',
    })
    @ApiProperty({ example: 1, type: Number })
    readonly preis!: BigNumber;

    @Transform(number2Percent)
    @Validate(DecimalMin, [BigNumber(0)], {
        message: 'rabatt muss positiv sein.',
    })
    @Validate(DecimalMax, [BigNumber(1)], {
        message: 'rabatt muss kleiner 1 sein.',
    })
    @IsOptional()
    @ApiProperty({ example: 0.1, type: Number })
    readonly rabattsatz: BigNumber | undefined;

    @IsBoolean()
    @IsOptional()
    @ApiProperty({ example: true, type: Boolean })
    readonly verfuegbar: boolean | undefined;

    @IsISO8601({ strict: true })
    @IsOptional()
    @ApiProperty({ example: '2021-01-31' })
    readonly erscheinungsdatum: Date | string | undefined;

    @IsUrl()
    @IsOptional()
    @ApiProperty({ example: 'https://test.de/', type: String })
    readonly homepage: string | undefined;

    @IsOptional()
    @ArrayUnique()
    @ApiProperty({ example: ['SPORT', 'VINTAGE', 'STREETWARE'] })
    readonly schlagwoerter: string[] | undefined;
}

/**
 * Entity-Klasse für Schuhe.
 */
export class SchuhDTO extends SchuhDtoOhneRef {
    @ValidateNested()
    @Type(() => ModellDTO)
    @ApiProperty({ type: ModellDTO })
    readonly modell!: ModellDTO; // NOSONAR

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AbbildungDTO)
    @ApiProperty({ type: [AbbildungDTO] })
    readonly abbildungen: AbbildungDTO[] | undefined;

    // AbbildungDTO
}
/* eslint-enable max-classes-per-file, @typescript-eslint/no-magic-numbers */
