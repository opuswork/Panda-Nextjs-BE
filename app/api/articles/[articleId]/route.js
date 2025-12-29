// app/api/articles/[articleId]/route.js

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/articles/[articleId]
 * Fetch a single article by its UUID
 */
export async function GET(request, { params }) {
  try {
    const { articleId } = params; // This is a string (e.g., "f86c...")

    const article = await prisma.article.findUnique({
      where: {
        id: articleId, // ✅ Use string directly, NO Number()
      },
      include: {
        comments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { message: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('GET article failed:', error);
    return NextResponse.json(
      { message: 'Failed to load article' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/articles/[articleId]
 * Update an article's content, title, or image
 */
export async function PATCH(request, { params }) {
  try {
    const { articleId } = params; // This is a String UUID
    const body = await request.json();

    const updatedArticle = await prisma.article.update({
      where: { 
        id: articleId // ✅ Use string directly
      },
      data: {
        title: body.title,
        content: body.content,
        image: body.image,
        author: body.author,
        // Only update fields that are provided in the body
      },
    });

    return NextResponse.json(updatedArticle);
  } catch (error) {
    console.error('PATCH article failed:', error);
    
    // Check if the error is because the article wasn't found
    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Failed to update article' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/articles/[articleId]
 * Remove an article and its associated comments
 */
export async function DELETE(request, { params }) {
  try {
    const { articleId } = params; // This is a String UUID

    // 1. Manually delete comments first if "onDelete: Cascade" 
    // is not set in your Prisma schema.
    await prisma.comment.deleteMany({
      where: { articleId: articleId },
    });

    // 2. Delete the article
    await prisma.article.delete({
      where: { 
        id: articleId // ✅ Use string directly
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE article failed:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: '이미 삭제되었거나 존재하지 않는 게시글입니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Failed to delete article' },
      { status: 500 }
    );
  }
}
