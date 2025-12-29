import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/articles/[articleId]/comments
 */
export async function GET(request, { params }) {
  try {
    const { articleId } = params; // This is a string (e.g., "f86c...")

    const comments = await prisma.comment.findMany({
      where: {
        articleId: articleId, // ✅ Removed Number() because model says String
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
 */
export async function POST(request, { params }) {
  try {
    const { articleId } = params;
    const body = await request.json();

    if (!body.content) {
      return NextResponse.json(
        { message: 'Content is required' },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        content: body.content,
        articleId: articleId, // ✅ Removed Number() here too
        // userId: body.userId ?? null, // optional
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