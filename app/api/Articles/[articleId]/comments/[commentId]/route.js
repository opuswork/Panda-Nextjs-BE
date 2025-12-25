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
    const { commentId } = params;
    const body = await request.json();

    if (!body.content) {
      return NextResponse.json(
        { message: 'Content is required' },
        { status: 400 }
      );
    }

    const updatedComment = await prisma.comment.update({
      where: {
        id: Number(commentId),
      },
      data: {
        content: body.content,
      },
    });

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error('PATCH comment failed:', error);
    return NextResponse.json(
      { message: 'Failed to update comment' },
      { status: 500 }
    );
  }
}
