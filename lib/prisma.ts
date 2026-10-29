import { PrismaClient } from "@prisma/client";
import { easternToday } from "./date";

// Ben takes over Emily's spot as Dr. Raffo's scribe, but doesn't start until
// November — so the record (already named Ben, with her template) keeps
// showing as "Emily" everywhere until Saturday, October 31st (Eastern).
// Reads only: lookups by name still match the stored "Ben".
const BEN_SHOWS_AS_EMILY_UNTIL = "2026-10-31";

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends({
    result: {
      staff: {
        name: {
          needs: { name: true },
          compute: (s) => (s.name === "Ben" && easternToday() < BEN_SHOWS_AS_EMILY_UNTIL ? "Emily" : s.name),
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// What a `prisma.$transaction(async (tx) => ...)` callback receives.
export type Tx = Omit<typeof prisma, "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on">;
