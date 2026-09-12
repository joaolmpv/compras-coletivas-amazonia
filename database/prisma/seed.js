// Popula o banco com um cenario minimo de compra coletiva e calcula o
// rateio de frete por comprador -- demonstra a modelagem multi-ator (OE2).

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const hub = await prisma.hub.upsert({
    where: { name: "Manaus" },
    update: {},
    create: {
      name: "Manaus",
      city: "Manaus - AM",
      fixedDispatchCost: 1800,
      variableCostPerM3: 95,
      capacityM3: 40,
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: { document: "00.000.000/0001-00" },
    update: {},
    create: {
      name: "Fornecedor Exemplo Ltda",
      document: "00.000.000/0001-00",
    },
  });

  const buyers = await Promise.all(
    [
      { name: "Comercio A", document: "11.111.111/0001-11", email: "a@example.com" },
      { name: "Comercio B", document: "22.222.222/0001-22", email: "b@example.com" },
      { name: "Comercio C", document: "33.333.333/0001-33", email: "c@example.com" },
    ].map((b) =>
      prisma.buyer.upsert({ where: { document: b.document }, update: {}, create: b })
    )
  );

  const volumesM3 = [8, 5, 12]; // volume de cada comprador neste lote
  const totalVolume = volumesM3.reduce((a, b) => a + b, 0);
  const totalCost = hub.fixedDispatchCost + hub.variableCostPerM3 * totalVolume;

  const lot = await prisma.lot.create({
    data: {
      hubId: hub.id,
      status: "CLOSED",
      totalVolumeM3: totalVolume,
      totalCost,
      dispatchDate: new Date(),
    },
  });

  // Rateio proporcional ao volume de cada comprador no lote
  for (const [i, buyer] of buyers.entries()) {
    const volumeM3 = volumesM3[i];
    const costShare = (volumeM3 / totalVolume) * totalCost;
    await prisma.participation.create({
      data: { lotId: lot.id, buyerId: buyer.id, volumeM3, costShare },
    });
  }

  await prisma.review.create({
    data: { supplierId: supplier.id, buyerId: buyers[0].id, rating: 5, comment: "Entrega no prazo." },
  });

  const participations = await prisma.participation.findMany({
    where: { lotId: lot.id },
    include: { buyer: true },
  });

  console.log(`Lote ${lot.id} | Hub: ${hub.name} | Volume total: ${totalVolume} m3 | Custo total: R$ ${totalCost.toFixed(2)}`);
  console.log("Rateio por comprador:");
  for (const p of participations) {
    console.log(`  - ${p.buyer.name}: ${p.volumeM3} m3 -> R$ ${p.costShare.toFixed(2)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
