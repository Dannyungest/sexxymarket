import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const email = process.argv[2] ?? 'admin@sexxymarket.com';
const password = process.argv[3] ?? 'DMoney@2026';

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('NO_USER');
      return;
    }
    console.log(
      JSON.stringify(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          isBlocked: user.isBlocked,
          isBlacklisted: user.isBlacklisted,
          hashPrefix: user.passwordHash.slice(0, 12),
        },
        null,
        2,
      ),
    );
    const ok = await argon2.verify(user.passwordHash, password);
    console.log('ARGON2_OK', ok);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('ERROR', error);
  process.exit(1);
});
