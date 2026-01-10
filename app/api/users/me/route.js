// app/api/users/me/route.js
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken"; // ✅ 이 줄이 누락되어 에러가 발생했습니다.
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
export const runtime = 'nodejs';

// ✅ CORS 헤더 정의
const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000", // 💡 '*' 사용 불가 (Credentials 사용 시)
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true", // 💡 쿠키 공유 허용
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/users/me
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "인증 토큰이 없습니다." }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ 어떤 이름으로 저장되어 있든 상관없이 값을 가져오도록 수정
    const userId = decoded.id || decoded.userId; 
    
    if (!userId) {
        // 로그를 남겨서 실제 토큰에 무엇이 들어있는지 확인하세요.
        console.log("실제 해독된 토큰 내용:", decoded); 
        return NextResponse.json({ message: "유효하지 않은 토큰 구조" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      // ✅ userId가 확실히 존재할 때만 쿼리 실행
      where: { id: userId }, 
      select: { 
        id: true, 
        email: true, 
        nickname: true, 
        firstName: true, 
        lastName: true, 
        image: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[GET_ME ERROR]", error);
    return NextResponse.json({ message: "유효하지 않은 토큰입니다." }, { status: 401 });
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
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      nickname: body.nickname,
      email: body.email,
      address: body.address,
      phoneNumber: body.phoneNumber, // ✅ DB에 저장(data)
      image: webPath,               // ✅ DB에 저장(data)
    },
    select: {
      id: true,
      email: true,
      firstName: true,  // 💡 모델에 name 대신 firstName, lastName이 있으므로 수정
      lastName: true,
      nickname: true,
      address: true,    // ✅ 수정 후 즉시 확인을 위해 포함
      phoneNumber: true, // ✅ 수정 후 즉시 확인을 위해 포함
      image: true,      // ✅ 수정 후 즉시 확인을 위해 포함 (이미지 깨짐 방지)
      updatedAt: true,  // ✅ 캐시 방지(Cache Busting)를 위해 포함 추천
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
