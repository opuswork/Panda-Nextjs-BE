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
    // 1. Await params to avoid 'undefined' id error in Next.js 15+
    const resolvedParams = await params;
    const { articleId } = resolvedParams;

  console.log("Extracted ID from API:", articleId); 

  if (!articleId) {
    return NextResponse.json({ error: "Missing articleId" }, { status: 400 });
  }

    const article = await prisma.article.findUnique({
      where: {
        id: articleId,
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
      { message: 'Internal Server Error' },
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
    const resolvedParams = await params;
    const { articleId } = resolvedParams;
    const body = await request.json();

    const updatedArticle = await prisma.article.update({
      where: { 
        id: articleId 
      },
      data: {
        title: body.title,
        content: body.content,
        image: body.image,
        author: body.author,
      },
    });

    return NextResponse.json(updatedArticle);
  } catch (error) {
    console.error('PATCH article failed:', error);
    
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
    const resolvedParams = await params;
    const { articleId } = resolvedParams;

    // 1. Manually delete associated comments
    await prisma.comment.deleteMany({
      where: { articleId: articleId },
    });

    // 2. Delete the article
    await prisma.article.delete({
      where: { 
        id: articleId 
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