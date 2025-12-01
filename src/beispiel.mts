import { PrismaClient } from './generated/prisma/index.js';
const prisma = new PrismaClient();

try {
    await prisma.$connect();
    const schuhe = await prisma.schuh.findMany();
    console.log(`schuhe=${JSON.stringify(schuhe)}`);
} finally {
    await prisma.$disconnect();
}
