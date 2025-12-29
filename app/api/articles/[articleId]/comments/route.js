import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/articles/[articleId]/comments
 */
export async function GET(request, { params }) {
  try {
    const { articleId } = await params; // This is a string (e.g., "f86c...")

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
// 1. Await params (REQUIRED in Next.js 15+)
    const resolvedParams = await params;
    const { articleId } = resolvedParams;

    // 2. Parse the request body
    const body = await request.json();

// 3. Validation
    if (!articleId) {
      return NextResponse.json({ message: 'articleId is missing' }, { status: 400 });
    }
    if (!body.content) {
      return NextResponse.json({ message: 'Content is required' }, { status: 400 });
    }
    
    console.log(`Creating comment for article: ${articleId}`);

    // 4. Prisma Create
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