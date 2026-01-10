import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs'; // npm install bcryptjs 필요

export async function PATCH(request) {
  try {
    // 1. 쿠키에서 토큰 추출 및 사용자 인증
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ message: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // 2. 요청 데이터 가져오기
    const { currentPassword, newPassword } = await request.json();

    if (!newPassword) {
      return NextResponse.json({ message: '새 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // 3. DB에서 유저 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 4. 가입 경로(provider)에 따른 검증 로직
    // 일반 로그인(local) 유저인 경우에만 기존 비밀번호 일치 여부 확인
    if (user.provider === 'local') {
        if (!currentPassword) {
            return NextResponse.json({ message: '현재 비밀번호를 입력해주세요.' }, { status: 400 });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return NextResponse.json({ message: '현재 비밀번호가 일치하지 않습니다.' }, { status: 400 });
        }
    }

    // 5. 새 비밀번호 암호화 및 DB 업데이트
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: '비밀번호가 성공적으로 변경되었습니다.' }, { status: 200 });

  } catch (error) {
    console.error('🚨 비밀번호 변경 에러:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    return NextResponse.json({ message: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}