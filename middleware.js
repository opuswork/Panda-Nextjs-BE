// PANDA-Nextjs-BE/middleware.js
// ------------------------------------------------------------
// 1. 미들웨어 설정
// 2026-01-10
// ------------------------------------------------------------
// PANDA-Nextjs-BE/middleware.js

import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // ✅ 수정된 로직: 환경 변수가 있으면 그 값을 쓰고, 없으면 로컬 주소를 씁니다.
  const allowedOrigin = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://helpful-brigadeiros-517905.netlify.app';

  // OPTIONS 요청 처리 (Preflight)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 나머지 요청에 대해서도 헤더를 추가하고 싶다면 아래와 같이 처리합니다.
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return response;
}