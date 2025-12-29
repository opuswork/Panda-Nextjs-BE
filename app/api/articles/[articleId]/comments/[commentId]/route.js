// app/api/articles/[articleId]/comments/[commentId]/route.js

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * DELETE /api/articles/[articleId]/comments/[commentId]
 */
export async function DELETE(request, { params }) {
  try {
    const { commentId } = params;

    await prisma.comment.delete({
      where: {
        id_articleId: {
          id: Number(commentId),
          articleId: Number(articleId),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE comment failed:', error);
    return NextResponse.json(
      { message: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/articles/[articleId]/comments/[commentId]
 */
export async function PATCH(request, { params }) {
  try {
    // 1. Await params (REQUIRED in Next.js 15+)
    const resolvedParams = await params;
    const { commentId } = resolvedParams; // Matches folder name [commentId]

    const body = await request.json();

    if (!commentId) {
      return NextResponse.json({ message: 'Comment ID is missing' }, { status: 400 });
    }

    // 2. Prisma Update
    // Note: Comment.id is an Int in your schema, so we convert string to Number
    const updatedComment = await prisma.comment.update({
      where: { 
        id: Number(commentId) 
      },
      data: {
        content: body.content,
      },
    });

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error('PATCH comment failed:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ message: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}


/**
 * DELETE /api/articles/[articleId]/comments/[commentId]
 */
export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const { commentId } = resolvedParams;

    await prisma.comment.delete({
      where: { 
        id: Number(commentId) 
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE comment failed:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ message: '이미 삭제된 댓글입니다.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}