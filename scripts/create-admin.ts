import "dotenv/config";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

async function main() {
  const name = process.env.ADMIN_NAME?.trim() || "PrintHub Admin";
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password.length < 12) {
    throw new Error(
      "Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters before running this script."
    );
  }

  const passwordHash = await hashPassword(password);

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    const user = await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        name,
        passwordHash,
        role: "ADMIN",
        emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(),
      },
    });

    console.log("Admin account updated successfully.");
    console.log("Role:", user.role);

    return;
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });

  console.log("Admin account created successfully.");
  console.log("Role:", user.role);
}

main()
  .catch((error) => {
    console.error("Create admin error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });