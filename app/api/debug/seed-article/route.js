import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
const prisma = new PrismaClient();

export async function GET() {
  const created = await prisma.article.create({
    data: {
      title: "Hello Panda",
      author: "Taeyoung",
      content: "Seeded from debug route",
      favoriteCount: 0,
    },
  });

  return NextResponse.json({ ok: true, created });
}
