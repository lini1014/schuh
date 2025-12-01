export function generateArtikelnummer() {
    const praefix = 'SH';
    const nummer = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    return `${praefix}${nummer}`;
}
