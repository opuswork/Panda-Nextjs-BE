// app/api/users/[userId]/route.js
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/users/:userId
 */
export async function GET(request, { params }) {
  try {
    const { userId } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user, { status: 200 });

  } catch (error) {
    console.error('[API] GET user failed:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/:userId
 */
export async function PATCH(request, { params }) {
  try {
    const { userId } = params;
    const body = await request.json();
    const { email, name, password } = body;

    const data = {};

    if (email) data.email = email;
    if (name) data.name = name;

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json(updatedUser, { status: 200 });

  } catch (error) {
    console.error('[API] PATCH user failed:', error);

    // Prisma "record not found"
    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/:userId
 */
export async function DELETE(request, { params }) {
  try {
    const { userId } = params;

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json(
      { message: 'User deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('[API] DELETE user failed:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
