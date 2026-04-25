import { PrismaClient, UserRole } from "@prisma/client";
import * as argon2 from "argon2";
import { resolveSeedOverwriteDecision } from "../src/catalog/seed-overwrite-policy";

const prisma = new PrismaClient();

async function main() {
  const forceSeedUpdate = process.env.SEED_FORCE_UPDATE === "true";
  const toys = await prisma.category.upsert({
    where: { slug: "toys" },
    update: { name: "Toys", parentId: null },
    create: { name: "Toys", slug: "toys" },
  });
  const pleasureMaterials = await prisma.category.upsert({
    where: { slug: "pleasure-materials" },
    update: { name: "Pleasure Materials", parentId: null },
    create: { name: "Pleasure Materials", slug: "pleasure-materials" },
  });
  const magazines = await prisma.category.upsert({
    where: { slug: "magazines" },
    update: { name: "Magazines", parentId: null },
    create: { name: "Magazines", slug: "magazines" },
  });
  const couples = await prisma.category.upsert({
    where: { slug: "couples-essentials" },
    update: { name: "Couples Essentials", parentId: null },
    create: { name: "Couples Essentials", slug: "couples-essentials" },
  });
  const lingerie = await prisma.category.upsert({
    where: { slug: "lingerie" },
    update: { name: "Lingerie", parentId: null },
    create: { name: "Lingerie", slug: "lingerie" },
  });
  const wellnessCare = await prisma.category.upsert({
    where: { slug: "wellness-care" },
    update: { name: "Wellness & Care", parentId: null },
    create: { name: "Wellness & Care", slug: "wellness-care" },
  });
  const giftSets = await prisma.category.upsert({
    where: { slug: "gift-sets" },
    update: { name: "Gift Sets", parentId: null },
    create: { name: "Gift Sets", slug: "gift-sets" },
  });
  await prisma.category.upsert({
    where: { slug: "performance-boosters" },
    update: { name: "Performance Boosters", parentId: null },
    create: { name: "Performance Boosters", slug: "performance-boosters" },
  });
  await prisma.category.upsert({
    where: { slug: "intimate-party-essentials" },
    update: { name: "Intimate Party Essentials", parentId: null },
    create: { name: "Intimate Party Essentials", slug: "intimate-party-essentials" },
  });

  await prisma.category.upsert({
    where: { slug: "toys-female" },
    update: { name: "Toys (Female)", parentId: toys.id },
    create: { name: "Toys (Female)", slug: "toys-female", parentId: toys.id },
  });
  await prisma.category.upsert({
    where: { slug: "toys-male" },
    update: { name: "Toys (Male)", parentId: toys.id },
    create: { name: "Toys (Male)", slug: "toys-male", parentId: toys.id },
  });
  await prisma.category.upsert({
    where: { slug: "kits-cards-bdsm-roleplay" },
    update: { name: "Kits, Cards, BDSM & Role-Play Cloths", parentId: pleasureMaterials.id },
    create: {
      name: "Kits, Cards, BDSM & Role-Play Cloths",
      slug: "kits-cards-bdsm-roleplay",
      parentId: pleasureMaterials.id,
    },
  });
  await prisma.category.upsert({
    where: { slug: "couples-games" },
    update: { name: "Couples Games", parentId: couples.id },
    create: { name: "Couples Games", slug: "couples-games", parentId: couples.id },
  });
  await prisma.category.upsert({
    where: { slug: "nightwear-luxury" },
    update: { name: "Nightwear Luxury", parentId: lingerie.id },
    create: { name: "Nightwear Luxury", slug: "nightwear-luxury", parentId: lingerie.id },
  });
  await prisma.category.upsert({
    where: { slug: "toy-cleaners-aftercare" },
    update: { name: "Toy Cleaners & Aftercare", parentId: wellnessCare.id },
    create: { name: "Toy Cleaners & Aftercare", slug: "toy-cleaners-aftercare", parentId: wellnessCare.id },
  });
  await prisma.category.upsert({
    where: { slug: "premium-bundles" },
    update: { name: "Premium Bundles", parentId: giftSets.id },
    create: { name: "Premium Bundles", slug: "premium-bundles", parentId: giftSets.id },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "support@sexxymarket.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "DMoney@2026";
  const passwordHash = await argon2.hash(adminPassword);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: UserRole.SUPER_ADMIN,
      passwordHash,
      firstName: "Sexxy",
      lastName: "Admin",
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: "Sexxy",
      lastName: "Admin",
      role: UserRole.SUPER_ADMIN,
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  const femaleToys = await prisma.category.findUniqueOrThrow({ where: { slug: "toys-female" } });
  const maleToys = await prisma.category.findUniqueOrThrow({ where: { slug: "toys-male" } });
  const pleasure = await prisma.category.findUniqueOrThrow({ where: { slug: "kits-cards-bdsm-roleplay" } });

  const seedProducts = [
    {
      slug: "rose-velvet-suction-massager",
      productCode: "SM-P101",
      name: "Rose Velvet Suction Massager",
      description: "Premium suction stimulator with whisper-quiet operation.",
      categoryId: femaleToys.id,
      priceNgn: 48900,
      stock: 30,
      imageUrl:
        "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=900&q=80",
      variants: [],
    },
    {
      slug: "pulse-core-mens-trainer",
      productCode: "SM-P102",
      name: "Pulse Core Men's Trainer",
      description: "Textured trainer with ergonomic comfort grip.",
      categoryId: maleToys.id,
      priceNgn: 42900,
      stock: 27,
      imageUrl:
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
      variants: [],
    },
    {
      slug: "role-play-satin-bodysuit",
      productCode: "SM-P103",
      name: "Role Play Satin Bodysuit",
      description: "Elegant role-play outfit with stretch comfort fit.",
      categoryId: pleasure.id,
      priceNgn: 27400,
      stock: 40,
      imageUrl:
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
      variants: [
        { label: "S", stock: 7 },
        { label: "M", stock: 10 },
        { label: "L", stock: 12 },
        { label: "XL", stock: 11 },
      ],
    },
    {
      slug: "sensual-living-magazine-issue-12",
      productCode: "SM-P104",
      name: "Sensual Living Magazine Issue 12",
      description: "Curated editorial issue on intimacy and confidence.",
      categoryId: magazines.id,
      priceNgn: 9500,
      stock: 100,
      imageUrl:
        "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
      variants: [],
    },
  ];

  for (const seed of seedProducts) {
    const existing = await prisma.product.findUnique({
      where: { slug: seed.slug },
      select: {
        id: true,
        slug: true,
        authoringStatus: true,
        revisions: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { id: true },
        },
      },
    });

    const isAuthoredProduct = Boolean(existing?.revisions.length);
    const decision = resolveSeedOverwriteDecision({
      exists: Boolean(existing),
      forceSeedUpdate,
      isAuthoredProduct,
    });

    if (decision === "create") {
      await prisma.product.create({
        data: {
          slug: seed.slug,
          name: seed.name,
          productCode: seed.productCode,
          description: seed.description,
          categoryId: seed.categoryId,
          priceNgn: seed.priceNgn,
          stock: seed.stock,
          isApproved: true,
          approvalStatus: "APPROVED",
          authoringStatus: "PUBLISHED",
          publishedAt: new Date(),
          requiresManualApproval: false,
          images: {
            create: [{ imageUrl: seed.imageUrl }],
          },
          variants: {
            create: seed.variants,
          },
        },
      });
      continue;
    }

    if (decision === "skip" && isAuthoredProduct) {
      console.log(`Skipping authored product ${seed.slug} (has revision history).`);
      continue;
    }

    if (decision === "skip") {
      console.log(`Skipping existing product ${seed.slug}. Set SEED_FORCE_UPDATE=true to allow update.`);
      continue;
    }

    await prisma.product.update({
      where: { slug: seed.slug },
      data: {
        name: seed.name,
        productCode: seed.productCode,
        description: seed.description,
        categoryId: seed.categoryId,
        priceNgn: seed.priceNgn,
        stock: seed.stock,
        isApproved: true,
        approvalStatus: "APPROVED",
        authoringStatus: "PUBLISHED",
        publishedAt: new Date(),
        requiresManualApproval: false,
        images: {
          deleteMany: {},
          create: [{ imageUrl: seed.imageUrl }],
        },
        variants: {
          deleteMany: {},
          create: seed.variants,
        },
      },
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
