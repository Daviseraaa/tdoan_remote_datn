import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@datn.com' },
    update: {},
    create: {
      email: 'admin@datn.com',
      name: 'Admin',
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@datn.com' },
    update: {},
    create: {
      email: 'user@datn.com',
      name: 'Demo User',
      password: await bcrypt.hash('user123', 10),
      role: Role.USER,
    },
  });

  console.log('Seeded users:', { admin: admin.email, user: user.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
