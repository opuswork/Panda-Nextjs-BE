import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

// ✅ 프론트엔드 주소를 명시적으로 설정합니다.
const FRONTEND_URL = 'http://localhost:3000';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET, // 백엔드 전용 시크릿 (꼭 .env에 있어야 함)
  `${FRONTEND_URL}/api/auth/google/callback` // 구글 콘솔에 등록된 리디렉션 URI와 일치해야 함
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error'); // 👈 이 줄을 추가하세요.

  // 1. 구글 로그인 취소 또는 에러 발생 시 처리 (추가할 부분)
  if (error) {
    return NextResponse.redirect(`${FRONTEND_URL}/auth`);
  }

  // 2. 코드가 없으면 프론트엔드 로그인 페이지로 돌려보냄
  if (!code) {
    return NextResponse.redirect(`${FRONTEND_URL}/auth`);
  }

  try {
    // 2. 코드를 구글 토큰으로 교환
    // 🚀 여기서 실패하면 GOOGLE_CLIENT_SECRET이 틀렸거나 Redirect URI 불일치일 확률이 높음
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // 3. 토큰으로 유저 정보 가져오기
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    console.log("🔍 로그인 시도 유저 이메일:", payload.email);

    // 4. DB 유저 확인 및 생성
    // 1. 유저 조회
    let user = await prisma.user.findUnique({ 
        where: { email: payload.email } 
    });
    console.log("🔍 유저 조회 결과:", user ? "존재" : "없음");

    if (!user) {
      console.log("🆕 신규 유저입니다. 생성을 시작합니다.");
      user = await prisma.user.create({
        data: {
          email: payload.email,
          nickname: payload.name || "Panda User",
          firstName: payload.given_name || "Guest",
          lastName: payload.family_name || "User",
          image: payload.picture,
          provider: 'google',
          providerId: payload.sub,
        },
      });
    } else {
      console.log("✅ 기존 유저를 찾았습니다. ID:", user.id);
    }

    // 2. JWT 생성 (여기서 500 에러가 많이 납니다)
    if (!process.env.JWT_SECRET) {
      throw new Error("❌ 서버 설정 에러: JWT_SECRET이 환경 변수에 없습니다.");
    }

    // 5. 우리 서비스 전용 JWT 생성
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // 6. ✅ 리디렉션 대상을 3000번 포트의 상품 목록으로 지정
    // const response = NextResponse.json({
    //   message: "구글 로그인 성공",
    //   user: { id: user.id, email: user.email, provider: user.provider },
    // });

    console.log("🎫 JWT 생성 완료");

    // ✅ 리다이렉트 주소를 변수에 담습니다.
    const redirectUrl = new URL('/profile', 'http://localhost:3000');
    
    // ✅ NextResponse.redirect를 직접 리턴하며 쿠키를 설정합니다.
    const response = NextResponse.redirect(redirectUrl);

    console.log("🔍 리다이렉트 주소:", redirectUrl.toString());

    // 3. 응답 및 쿠키 설정
    // 7. 쿠키 설정 (3000번 프론트엔드 도메인에서 읽을 수 있게 함)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7일
    });

    return response;
  } catch (error) {
    // 🔥 500 에러의 진짜 이유를 터미널에 출력합니다.
        console.error("🚨 [Google Callback 500 Error 상세내용]:");
        console.error("메시지:", error.message);
        console.error("스택 트레이스:", error.stack);

        if (error.response) {
        console.error("구글 서버 응답:", error.response.data);
        }

        return NextResponse.redirect(`${FRONTEND_URL}/auth?error=server_error`);  //Catch All 처리 (서버 에러 발생 시)
   }
}