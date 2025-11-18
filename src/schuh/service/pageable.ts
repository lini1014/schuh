export const DEFAULT_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_NUMBER = 0;

/**
 * Datenstruktur für _Pagination_.
 */
export type Pageable = {
    /**
     * Seitennummer mit Zählung ab 0.
     */
    readonly number: number;
    /**
     * Maximale Anzahl Datensätze auf einer Seite
     */
    readonly size: number;
};

/**
 * Datenstruktur, wenn ein Objekt von `Pageable` erstellt wird.
 */
export type PageableProps = {
    /**
     * Seitennummer mit Zählung ab 0.
     */
    readonly number?: string | undefined;

    /**
     * Maximale Anzahl Datensätze auf einer Seite
     */
    readonly size?: string | undefined;
};

/**
 * Factory-Funktion, um ein Objekt vom Typ `Pageable` zu erstellen.
 * @returns Objekt vom Typ `Pageable`.
 */
export function createPageable({ number, size }: PageableProps): Pageable {
    let numberFloat = Number(number);
    let numberInt: number;
    if (isNaN(numberFloat) || !Number.isInteger(numberFloat)) {
        numberInt = DEFAULT_PAGE_NUMBER;
    } else {
        numberInt = numberFloat - 1;
        if (numberInt < 0) {
            numberInt = DEFAULT_PAGE_NUMBER;
        }
    }

    let sizeFloat = Number(size);
    let sizeInt: number;
    if (isNaN(sizeFloat) || !Number.isInteger(sizeFloat)) {
        sizeInt = DEFAULT_PAGE_SIZE;
    } else {
        sizeInt = sizeFloat;
        if (sizeInt < 1 || sizeInt > MAX_PAGE_SIZE) {
            sizeInt = DEFAULT_PAGE_NUMBER;
        }
    }

    return { number: numberInt, size: sizeInt };
}
