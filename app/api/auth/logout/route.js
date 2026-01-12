// app/api/auth/logout/route.js
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// CORS 설정
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://helpful-brigadeiros-517905.netlify.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

// OPTIONS 요청 처리 (CORS Preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST() {
  const response = NextResponse.json(
    { message: '성공적으로 로그아웃되었습니다.' },
    { status: 200, headers: corsHeaders }
  );

  // ✅ 쿠키 삭제 로직 보완 (크로스 도메인 지원)
  response.cookies.set('auth_token', '', {
    path: '/',
    // 즉시 만료시키기 위해 과거 날짜로 설정하거나 maxAge를 0으로 설정
    maxAge: 0,
    expires: new Date(0), 
    
    // 보안 속성: 로그인할 때와 동일하게 맞춰주는 것이 좋습니다.
    // 크로스 도메인에서 쿠키를 삭제하려면 sameSite: 'none'과 secure: true가 필요합니다.
    httpOnly: true,
    secure: true, // ✅ 크로스 도메인 쿠키 삭제를 위해 true로 설정
    sameSite: 'none', // ✅ 크로스 도메인 쿠키 삭제를 위해 'none'으로 설정
  });

  return response;
}