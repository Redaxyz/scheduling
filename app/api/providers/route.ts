import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const providers = await prisma.provider.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(providers);
}
