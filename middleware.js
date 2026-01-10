// PANDA-Nextjs-BE/middleware.js
// ------------------------------------------------------------
// 1. 미들웨어 설정
// 2026-01-10
// ------------------------------------------------------------
import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // 1. CORS 설정을 위한 Origin 결정 (배포 환경 vs 로컬 환경)
  const allowedOrigin = process.env.NEXT_PUBLIC_FRONTEND_URL === 'production' 
    ? 'https://helpful-brigadeiros-517905.netlify.app' // ✅ 실제 Netlify 주소로 변경
    : 'http://localhost:3000';

  // 2. OPTIONS 요청 처리 (Preflight)
  // 브라우저가 본 요청을 보내기 전 권한을 확인하는 단계입니다.
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

  // 3. 기존 인증(Authentication) 및 페이지 보호 로직
  const token = request.cookies.get('auth_token')?.value;
  const isProtectedRoute = pathname.startsWith('/profile') || pathname.startsWith('/edit-profile');

  // 토큰이 없는데 보호된 경로에 접근할 경우 (로컬 유지보수용)
  if (!token && isProtectedRoute) {
    const url = new URL('/auth', request.url);
    return NextResponse.redirect(url);
  }

  // 4. 응답 생성 및 CORS 헤더 주입
  const response = NextResponse.next();

  // 요청 온 Origin이 허용된 곳이라면 헤더를 붙여줍니다.
  if (origin === allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }

  return response;
}

// 미들웨어가 작동할 경로 (API와 프로필 관련 경로 포함)
export const config = {
  matcher: ['/api/:path*', '/profile/:path*', '/edit-profile/:path*'],
};