// app/api/articles/[articleId]/comments/route.js

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/articles/[articleId]/comments
 * Load comments for an article
 */
export async function GET(request, { params }) {
  try {
    const { articleId } = params;

    const comments = await prisma.comment.findMany({
      where: {
        articleId: Number(articleId),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('GET comments failed:', error);
    return NextResponse.json(
      { message: 'Failed to load comments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/articles/[articleId]/comments
 * Create a comment
 */
export async function POST(request, { params }) {
  try {
    const { articleId } = params;
    const body = await request.json();

    // Example body validation (minimal)
    if (!body.content) {
      return NextResponse.json(
        { message: 'Content is required' },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        content: body.content,
        articleId: Number(articleId),
        userId: body.userId ?? null, // optional
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('POST comment failed:', error);
    return NextResponse.json(
      { message: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
