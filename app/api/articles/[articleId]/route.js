// app/api/articles/[articleId]/route.js

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
export const runtime = 'nodejs';


// 💡 공통 함수: 서버에서 물리 파일을 삭제하는 함수
async function deletePhysicalFile(filePath) {
  if (!filePath) return;
  try {
    // DB에는 /uploads/... 로 저장되어 있으므로 실제 경로는 public을 붙여야 합니다.
    const fullPath = path.join(process.cwd(), "public", filePath);
    await unlink(fullPath);
    console.log(`[File System] Deleted old file: ${fullPath}`);
  } catch (err) {
    console.warn(`[File System] Failed to delete file (maybe already gone):`, err.message);
  }
}

/**
 * GET /api/articles/[articleId]
 * Fetch a single article by its UUID
 */
export async function GET(request, context) {
  try {
    const params = await context.params;
    
    // ✅ 폴더명이 [articleId]이므로 params.articleId로 가져와야 합니다!
    const articleId = params.articleId; 

    // 디버깅용 로그
    console.log("조회 요청된 Article ID:", articleId);

    if (!articleId) {
      return NextResponse.json({ message: "ID가 없습니다." }, { status: 400 });
    }

    const article = await prisma.article.findUnique({
      where: { 
        id: articleId // Prisma 모델의 실제 필드명은 id이므로 여기에 전달
      },
      include: {
        author: {
          select: {
            nickname: true,
            firstName: true,
            lastName: true,
            image: true,
          }
        }
      }
    });

    if (!article) {
      return NextResponse.json({ message: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(article, { status: 200 });
  } catch (error) {
    console.error("상세조회 에러:", error);
    return NextResponse.json({ message: "서버 오류", error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/articles/[articleId]
 */
export async function PATCH(request, { params }) {
  try {
    const { articleId } = await params;
    
    // 1. 기존 게시글 정보 조회 (기존 파일 경로 확인을 위함)
    const existingArticle = await prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!existingArticle) {
      return NextResponse.json({ message: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    // 2. FormData 처리
    const formData = await request.formData();
    const title = formData.get("title");
    // author는 관계 필드이므로 수정하지 않음 (작성자는 변경 불가)
    const content = formData.get("content");
    const file = formData.get("image"); // 신규 파일 객체 또는 null
    const deleteImage = formData.get("deleteImage"); // 이미지 삭제 요청 여부

    let newImagePath = existingArticle.image;
    let originalFileName = existingArticle.originalFileName;

    // 3. 이미지 변경 로직
    if (file && typeof file !== "string") {
      // (1) 신규 파일명 생성 및 저장
      originalFileName = file.name;
      const fileExtension = path.extname(originalFileName);
      const baseName = path.basename(originalFileName, fileExtension);
      const encodedName = Buffer.from(baseName).toString('base64').replace(/[=/+]/g, '');
      const fileName = `${Date.now()}-${encodedName}${fileExtension}`;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      
      const fullPath = path.join(uploadDir, fileName);
      await writeFile(fullPath, buffer);

      // (2) 기존 물리 파일 삭제
      if (existingArticle.image) {
        await deletePhysicalFile(existingArticle.image);
      }
      
      newImagePath = `/uploads/${fileName}`;
    } else if (deleteImage === "true") {
      // 이미지만 삭제하고 싶은 경우
      await deletePhysicalFile(existingArticle.image);
      newImagePath = null;
      originalFileName = null;
    }

    // 4. DB 업데이트
    // author는 관계 필드이므로 수정하지 않음 (작성자는 변경 불가)
    const updatedArticle = await prisma.article.update({
      where: { id: articleId },
      data: {
        title: title || undefined,
        content: content || undefined,
        image: newImagePath,
        originalFileName: originalFileName,
      },
    });

    return NextResponse.json(updatedArticle);

  } catch (error) {
    console.error("PATCH article failed:", error);
    return NextResponse.json({ message: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * DELETE /api/articles/[articleId]
 */
export async function DELETE(request, { params }) {
  try {
    const { articleId } = await params;

    // 1. 삭제 전 정보 조회 (이미지 경로를 미리 확보)
    const articleToDelete = await prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!articleToDelete) {
      return NextResponse.json({ message: "게시글을 찾을 수 없습니다." }, { status: 404 });
    }

    // 2. DB에서 게시글 및 댓글 삭제 (댓글은 articleId로 관계 맺어진 경우)
    await prisma.comment.deleteMany({ where: { articleId } });
    await prisma.article.delete({ where: { id: articleId } });

    // 3. 물리적 이미지 파일 삭제
    if (articleToDelete.image) {
      await deletePhysicalFile(articleToDelete.image);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("DELETE article failed:", error);
    return NextResponse.json({ message: "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}