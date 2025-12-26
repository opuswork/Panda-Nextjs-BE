import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs"; // Prisma needs Node runtime

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 10)));

    const orderByParam = (searchParams.get("orderBy") || "recent").toLowerCase();
    const keyword = (searchParams.get("keyword") || "").trim();

    const orderBy = orderByParam === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" };

    const where = keyword
      ? {
          OR: [
            { title: { contains: keyword, mode: "insensitive" } },
            { content: { contains: keyword, mode: "insensitive" } },
            { author: { contains: keyword, mode: "insensitive" } },
          ],
        }
      : undefined;

    const [totalCount, rows] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          author: true,
          image: true,
          favoriteCount: true,
          createdAt: true,
        },
      }),
    ]);

    const articles = rows.map((a) => ({
      ...a,
      favoriteCount: a.favoriteCount ?? 0,
    }));

    return NextResponse.json({ articles, totalCount });
  } catch (err) {
    console.error("[API] GET /api/articles failed:", err);

    return NextResponse.json(
      {
        ok: false,
        version: "articles-debug-001",
        message: "Failed to fetch articles",
        error: err?.message ?? String(err),
        code: err?.code,
        meta: err?.meta ?? null,
        // don't leak stack in prod
        stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
      },
      { status: 500 }
    );
  }
}
