/**
 * Das Modul besteht aus Typdefinitionen für die Suche in `SchuhService`.
 * @packageDocumentation
 */

import type { $Enums } from '../../generated/prisma/client.js';

// Typdefinition für `find`
export type Suchparameter = {
    readonly artikelnummer?: string;
    readonly rating?: number | string;
    readonly typ?: $Enums.Schuhtyp;
    readonly preis?: number;
    readonly rabattsatz?: number;
    readonly verfuegbar?: boolean;
    readonly erscheinungsdatum?: string;
    readonly homepage?: string;
    readonly vintage?: string;
    readonly sport?: string;
    readonly streetware?: string;
    readonly modell?: string;
};

// gueltige Namen fuer die Suchparameter
export const suchparameterNamen = [
    'artikelnummer',
    'rating',
    'typ',
    'preis',
    'rabattsatz',
    'verfuegbar',
    'erscheinungsdatum',
    'homepage',
    'schlagwoerter',
    'modell',
];
