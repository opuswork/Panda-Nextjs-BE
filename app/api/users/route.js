// app/api/users/route.js
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs'; // ✅ REQUIRED for bcrypt

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, nickname } = body;

    console.log('[API] Creating user:', email);

    /* 1️⃣ Validate input */
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { message: 'Email, password, firstName, and lastName are required' },
        { status: 400 }
      );
    }

    /* 2️⃣ Check if user already exists */
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'Email already exists' },
        { status: 409 }
      );
    }

    /* 3️⃣ Hash password */
    const hashedPassword = await bcrypt.hash(password, 10);

    /* 4️⃣ Create user + preference (transaction-safe) */
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        nickname: nickname || null,
        preference: {
          create: {
            receiveEmail: false,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        nickname: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });

  } catch (error) {
    console.error('[API] User creation failed:', error);

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
