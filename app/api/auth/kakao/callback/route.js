// app/api/auth/kakao/callback/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_INFO_URL = 'https://kapi.kakao.com/v2/user/me';

// ✅ 하드코딩된 주소를 환경 변수로 교체 (Fallback 유지)
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://helpful-brigadeiros-517905.netlify.app';
const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || 'https://panda-nextjs-be.vercel.app/api/auth/kakao/callback';

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://helpful-brigadeiros-517905.netlify.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}


export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // 1. 사용자가 취소했거나 인가 코드가 없는 경우 처리
  if (error || !code) {
    console.log("🚫 카카오 로그인 취소 또는 에러:", error);
    return NextResponse.redirect(`${FRONTEND_URL}/auth`);
  }

  try {
    console.log("🔑 카카오 인가 코드로 토큰 교환 시작...");

    // 2. 인가 코드를 액세스 토큰으로 교환
    const tokenResponse = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID,
        client_secret: process.env.KAKAO_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) {
      console.error("❌ 카카오 토큰 응답 에러:", tokens);
      throw new Error('카카오 토큰 발급 실패');
    }

    // 3. 액세스 토큰으로 사용자 정보 가져오기
    console.log("👤 카카오 사용자 정보 가져오는 중...");
    const userResponse = await fetch(KAKAO_USER_INFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const kakaoUser = await userResponse.json();

    // 데이터 추출 (카카오 데이터 구조에 맞춤)
    const providerId = kakaoUser.id.toString();
    const email = kakaoUser.kakao_account?.email; // 필수 동의이므로 존재함
    const nickname = kakaoUser.properties?.nickname || kakaoUser.kakao_account?.profile?.nickname || "Panda User";
    const profileImage = kakaoUser.properties?.profile_image || kakaoUser.kakao_account?.profile?.thumbnail_image_url;

    console.log(`🔍 카카오 로그인 시도: ${email} (${nickname})`);

    // 4. DB 유저 확인 및 가입
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log("🆕 신규 카카오 유저 생성 중...");
      user = await prisma.user.create({
        data: {
            email,
            nickname,
            // ✅ Prisma 모델의 필수 값들을 채워줍니다.
            firstName: nickname, // 카카오는 이름 구분이 없으므로 닉네임을 성/이름 중 하나에 할당합니다.
            lastName: "",        // 필수라면 빈 문자열이라도 넣어주어야 에러가 나지 않습니다.
            image: profileImage,
            provider: 'kakao',
            providerId: providerId,
        },
      });
    } else {
      console.log("✅ 기존 유저 확인됨 ID:", user.id);
    }

    // 5. 우리 서비스 전용 JWT 발행
    if (!process.env.JWT_SECRET) {
      throw new Error("❌ JWT_SECRET이 설정되지 않았습니다.");
    }

    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // 6. 리다이렉트 및 쿠키 설정
    const response = NextResponse.redirect(`${FRONTEND_URL}/profile`);
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7일
    });

    console.log("🚀 카카오 로그인 성공! 프로필로 이동합니다.");
    return response;

  } catch (err) {
    console.error("🚨 카카오 로그인 상세 에러:", err.message);
    return NextResponse.redirect(`${FRONTEND_URL}/auth?error=kakao_login_failed`);
  }
}