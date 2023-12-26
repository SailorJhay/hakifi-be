import { BaseUnit, PrismaClient } from '@prisma/client';
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  let allTokens = await prisma.token.findMany({
    select: {
      symbol: true,
    },
  });
  if (allTokens.length === 0) {
    const tokens = JSON.parse(
      fs.readFileSync('prisma/seed/data/tokens.json', 'utf8'),
    );
    await prisma.token.createMany({
      data: tokens,
    });

    allTokens = await prisma.token.findMany({
      select: {
        symbol: true,
      },
    });
  }

  const pairs = allTokens.map((token) => ({
    asset: token.symbol,
    unit: BaseUnit.USDT,
    symbol: `${token.symbol}${BaseUnit.USDT}`,
  }));

  await prisma.pair.createMany({
    data: pairs,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
