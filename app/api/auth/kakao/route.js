// app/api/auth/kakao/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_INFO_URL = 'https://kapi.kakao.com/v2/user/me';

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

export async function POST(request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { message: "인증 코드가 없습니다." },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("🔑 카카오 인가 코드로 토큰 교환 시작...");

    // 1. 인가 코드를 액세스 토큰으로 교환
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
      return NextResponse.json(
        { message: "카카오 토큰 발급 실패" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. 액세스 토큰으로 사용자 정보 가져오기
    console.log("👤 카카오 사용자 정보 가져오는 중...");
    const userResponse = await fetch(KAKAO_USER_INFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const kakaoUser = await userResponse.json();

    // 데이터 추출 (카카오 데이터 구조에 맞춤)
    const providerId = kakaoUser.id.toString();
    const email = kakaoUser.kakao_account?.email;
    const nickname = kakaoUser.properties?.nickname || kakaoUser.kakao_account?.profile?.nickname || "Panda User";
    const profileImage = kakaoUser.properties?.profile_image || kakaoUser.kakao_account?.profile?.thumbnail_image_url;

    console.log(`🔍 카카오 로그인 시도: ${email} (${nickname})`);

    // 3. DB 유저 확인 및 가입
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log("🆕 신규 카카오 유저 생성 중...");
      user = await prisma.user.create({
        data: {
          email,
          nickname,
          firstName: nickname,
          lastName: "",
          image: profileImage,
          provider: 'kakao',
          providerId: providerId,
        },
      });
    } else {
      console.log("✅ 기존 유저 확인됨 ID:", user.id);
      // ✅ 기존 유저도 카카오 로그인을 사용하는 경우 provider 업데이트
      if (user.provider !== 'kakao') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            provider: 'kakao',
            providerId: providerId,
            image: user.image || profileImage,
          },
        });
        console.log("✅ 기존 유저의 provider를 'kakao'로 업데이트했습니다.");
      }
    }

    // 4. JWT 생성
    if (!process.env.JWT_SECRET) {
      throw new Error("❌ JWT_SECRET이 설정되지 않았습니다.");
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. 응답 및 쿠키 설정 (크로스 도메인 지원)
    const response = NextResponse.json(
      { message: "카카오 로그인 성공", user: { id: user.id, email: user.email, provider: user.provider } },
      { headers: corsHeaders }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: true, // ✅ 크로스 도메인 쿠키를 위해 true로 설정
      sameSite: 'none', // ✅ 크로스 도메인 쿠키를 위해 'none'으로 설정
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7일
    });

    console.log("🚀 카카오 로그인 성공! 쿠키 설정 완료.");
    return response;

  } catch (err) {
    console.error("🚨 카카오 로그인 상세 에러:", err.message);
    return NextResponse.json(
      { message: "카카오 로그인 실패", details: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
