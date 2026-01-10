import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers"; 
import fs from 'fs';

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
      // 1. 전체 개수 구하기 (기존과 동일)
      prisma.article.count({ where }),

      // 2. 페이지네이션된 데이터 가져오기
      prisma.article.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          // ✅ [수정] 단순 true 대신 중첩 select를 사용하여 작성자 정보를 가져옵니다.
          author: {
            select: {
              nickname: true,
              firstName: true,
              lastName: true,
              image: true, // 작성자의 프로필 이미지도 목록에 띄우고 싶다면 추가
            },
          },
          image: true, // 게시글의 썸네일 이미지
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


export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401, headers: corsHeaders });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const formData = await request.formData();
    const title = formData.get("title");
    const author = formData.get("author");
    const content = formData.get("content");
    const file = formData.get("image");

    let savedFilePath = null;
    let originalFileName = null;

    if (file && typeof file !== "string") {
      originalFileName = file.name; // 원본 파일명 (예: "내사진.jpg")
      
      // 1. 파일명 인코딩 (Base64)
      // 파일명에 특수문자가 있을 수 있으므로 영문/숫자로만 구성된 Base64로 변환합니다.
      const fileExtension = path.extname(originalFileName); // 확장자 추출 (.jpg)
      const baseName = path.basename(originalFileName, fileExtension); // 이름만 추출
      const encodedName = Buffer.from(baseName).toString('base64')
                            .replace(/[=/+]/g, ''); // 파일명으로 쓸 수 없는 문자 제거
      
      const fileName = `${Date.now()}-${encodedName}${fileExtension}`;
      
      // 2. 물리적 파일 저장
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      
      const fullPath = path.join(uploadDir, fileName);
      await writeFile(fullPath, buffer);
      
      // DB의 image 컬럼에 저장할 경로
      savedFilePath = `/uploads/${fileName}`;
    }

    // 3. DB 저장 (두 컬럼 모두 기록)
  const created = await prisma.article.create({
    data: {
      title: title || undefined,
      content: content || undefined,
      image: savedFilePath,
      originalFileName: originalFileName,
      authorId: decoded.userId, // ✅ 이제 이것 하나만으로 충분합니다!
    },
    // 결과물에 작성자 정보를 포함해서 받고 싶다면 아래를 추가하세요
    include: {
      author: {
        select: { nickname: true, firstName: true, lastName: true }
      }
    }
  });

    return NextResponse.json(created, { status: 201 });

  } catch (error) {
    console.error("Article Create Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}