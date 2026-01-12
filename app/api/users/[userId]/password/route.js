// app/api/users/[userId]/password/route.js

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

// ✅ 등록하신 환경 변수를 사용하여 프론트엔드 주소를 동적으로 결정합니다.
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://panda-deals.netlify.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};
  
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * PATCH /api/users/[userId]/password
 * 비밀번호 변경 API
 */
export async function PATCH(request, { params }) {
  // ✅ Next.js 15 이상을 사용 중이라면 params를 await 해야 할 수 있습니다.
  const { id } = params; 
  const { currentPassword, newPassword } = await request.json();

  try {
    // 1. 인증 확인: 쿠키에서 auth_token 가져오기
    const cookieStore = cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    // 2. JWT 토큰 검증 및 본인 여부 확인
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.userId !== id) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    // 3. DB에서 해당 유저 조회
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    /**
     * 4. 비밀번호 검증 로직
     * - 구글 사용자가 처음 비밀번호를 설정하는 경우: currentPassword 검증 생략
     * - 기존 비밀번호가 있는 일반 유저: currentPassword 검증 필수
     */
    if (user.password) {
      if (!currentPassword) {
        return NextResponse.json({ message: '현재 비밀번호를 입력해주세요.' }, { status: 400 });
      }
      
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return NextResponse.json({ message: '현재 비밀번호가 일치하지 않습니다.' }, { status: 400 });
      }
    }

    // 5. 새 비밀번호 유효성 검사 (최소 8자)
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ message: '비밀번호는 최소 8자 이상이어야 합니다.' }, { status: 400 });
    }

    // 6. 새 비밀번호 암호화 (Hashing)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 7. DB 업데이트
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: '비밀번호가 성공적으로 변경되었습니다.' }, { status: 200 });

  } catch (error) {
    console.error('❌ [Password API Error]:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }
    
    return NextResponse.json({ message: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}