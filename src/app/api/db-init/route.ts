import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";


const execAsync = promisify(exec);

export async function GET() {
  const results: Record<string, unknown> = {
    database_url_configured: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Run prisma db push
    let pushCmd = "node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss";
    try {
      const { stdout, stderr } = await execAsync(pushCmd, {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
      results.db_push_stdout = stdout;
      results.db_push_stderr = stderr;
    } catch (cmdErr) {
      // Fallback to npx
      pushCmd = "npx prisma db push --skip-generate --accept-data-loss";
      const { stdout, stderr } = await execAsync(pushCmd, {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
      results.db_push_stdout = stdout;
      results.db_push_stderr = stderr;
    }

    // 2. Run seed-users.js
    try {
      const { stdout: sOut } = await execAsync("node ./scripts/seed-users.js", {
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
      results.seed_stdout = sOut;
    } catch (seedErr) {
      results.seed_warning = seedErr instanceof Error ? seedErr.message : String(seedErr);
    }

    // 3. Verify tables exist
    const sessionCount = await prisma.transitSession.count();
    const userCount = await prisma.user.count();
    results.tables_verified = true;
    results.existing_sessions = sessionCount;
    results.existing_users = userCount;
    results.success = true;

    return NextResponse.json(results);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.success = false;
    results.error = errorMsg;
    return NextResponse.json(results, { status: 500 });
  }
}
