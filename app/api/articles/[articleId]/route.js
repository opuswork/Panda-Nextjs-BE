// app/api/articles/[articleId]/route.js

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/articles/[articleId]
 */
export async function GET(request, { params }) {
  try {
    const { articleId } = params;

    const article = await prisma.article.findUnique({
      where: { id: Number(articleId) },
      include: {
        comments: true, // optional
      },
    });

    if (!article) {
      return NextResponse.json(
        { message: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('GET article failed:', error);
    return NextResponse.json(
      { message: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/articles/[articleId]
 */
export async function PATCH(request, { params }) {
  try {
    const { articleId } = params;
    const body = await request.json();

    const updatedArticle = await prisma.article.update({
      where: { id: Number(articleId) },
      data: body,
    });

    return NextResponse.json(updatedArticle);
  } catch (error) {
    console.error('PATCH article failed:', error);

    return NextResponse.json(
      { message: 'Failed to update article' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/articles/[articleId]
 */
export async function DELETE(request, { params }) {
  try {
    const { articleId } = params;

    await prisma.article.delete({
      where: { id: Number(articleId) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE article failed:', error);

    return NextResponse.json(
      { message: 'Failed to delete article' },
      { status: 500 }
    );
  }
}
