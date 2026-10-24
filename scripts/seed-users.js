/**
 * scripts/seed-users.js
 * Creates or updates the default Admin and Viewer accounts in PostgreSQL.
 *
 * Run with: node scripts/seed-users.js
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Agesichain user seed...");

  const adminPasswordHash = await bcrypt.hash("AgeisChain2026!", 10);
  const viewerPasswordHash = await bcrypt.hash("Viewer2026!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@agesichain.com" },
    update: {
      password: adminPasswordHash,
      role: "ADMIN",
      name: "Fleet Administrator",
    },
    create: {
      email: "admin@agesichain.com",
      name: "Fleet Administrator",
      password: adminPasswordHash,
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin account ready: ${admin.email} (Role: ${admin.role})`);

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@agesichain.com" },
    update: {
      password: viewerPasswordHash,
      role: "VIEWER",
      name: "Logistics Inspector",
    },
    create: {
      email: "viewer@agesichain.com",
      name: "Logistics Inspector",
      password: viewerPasswordHash,
      role: "VIEWER",
    },
  });
  console.log(`✅ Viewer account ready: ${viewer.email} (Role: ${viewer.role})`);

  console.log("\nDefault credentials:");
  console.log("-----------------------------------------");
  console.log("Admin:  admin@agesichain.com  / AgeisChain2026!");
  console.log("Viewer: viewer@agesichain.com / Viewer2026!");
  console.log("-----------------------------------------");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
