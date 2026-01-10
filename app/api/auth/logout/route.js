// app/api/auth/logout/route.js
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json(
    { message: '성공적으로 로그아웃되었습니다.' },
    { status: 200 }
  );

  // ✅ 쿠키 삭제 로직 보완
  response.cookies.set('auth_token', '', {
    path: '/',
    // 즉시 만료시키기 위해 과거 날짜로 설정하거나 maxAge를 0으로 설정
    maxAge: 0,
    expires: new Date(0), 
    
    // 보안 속성: 로그인할 때와 동일하게 맞춰주는 것이 좋습니다.
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return response;
}