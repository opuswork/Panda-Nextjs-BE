// app/api/auth/google/route.js

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

// ✅ 환경 변수 적용: 등록하신 NEXT_PUBLIC_FRONTEND_URL을 사용합니다.
const allowedOrigin = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://helpful-brigadeiros-517905.netlify.app';

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}


const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  // 배포 환경이면 실제 URL을, 아니면 로컬 URL을 사용하도록 환경 변수화하세요.
  process.env.GOOGLE_REDIRECT_URI
);

// 🔍 디버깅용 로그 (배포 직후 Vercel Logs에서 확인하세요)
console.log("Environment Check:", {
  hasClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI
});

/**
 * POST /api/auth/google
 * 구글 로그인 처리 (idToken, accessToken, 또는 code로 처리)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { idToken, accessToken, code, redirectUri } = body;

    let payload;

    // authorization code가 있으면 code로 access token 교환
    if (code) {
      const { tokens } = await client.getToken({
        code,
        redirect_uri: redirectUri || `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:4000'}/api/auth/google/callback`,
      });

      const accessTokenFromCode = tokens.access_token;
      
      // Access Token으로 사용자 정보 가져오기
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessTokenFromCode}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('구글 사용자 정보를 가져오는데 실패했습니다.');
      }

      const userInfo = await userInfoResponse.json();
      
      // payload 형식으로 변환
      payload = {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        sub: userInfo.id, // 구글 사용자 ID
      };
    } else if (idToken) {
      // 1. 구글 ID 토큰 검증
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload(); // 이메일, 이름, 구글ID 등이 들어있음
    } else if (accessToken) {
      // 2. Access Token으로 사용자 정보 가져오기
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('구글 사용자 정보를 가져오는데 실패했습니다.');
      }

      const userInfo = await userInfoResponse.json();
      
      // payload 형식으로 변환
      payload = {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        sub: userInfo.id, // 구글 사용자 ID
      };
    } else {
      return NextResponse.json({ message: "code, idToken 또는 accessToken이 필요합니다." }, { status: 400 });
    }

    // 2. 유저 확인 및 자동 가입
    let user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      // 구글에서 제공하는 이름 정보 파싱
      const firstName = payload.given_name || payload.name?.split(' ')[0] || 'User';
      const lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '';
      
      user = await prisma.user.create({
        data: {
          email: payload.email,
          firstName: firstName,
          lastName: lastName || firstName, // lastName이 없으면 firstName 사용
          nickname: payload.name || payload.email.split('@')[0],
          image: payload.picture,
          password: null, // 구글 로그인은 비밀번호 불필요
          provider: 'google',
          providerId: payload.sub,
        },
      });
    }

    // 3. 기존 JWT 발급 로직 재사용 (auth_token 쿠키 설정)
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const response = NextResponse.json({ message: "구글 로그인 성공", user });
    
    // ✅ 기존 AuthProvider가 인식할 수 있도록 동일한 쿠키 설정
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7일
    });

    return response;
  } catch (error) {
    console.error("Google Auth Error:", error);
    return NextResponse.json({ message: "인증 실패" }, { status: 401 });
  }
}