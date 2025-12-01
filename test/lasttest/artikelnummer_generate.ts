export function generateArtikelnummer() {
    const prefix = 'SH';
    const nummer = String(Math.floor(Math.random() * 100_000)).padStart(5, '0');
    return `${prefix}${nummer}`;
}
