// app/api/auth/google/route.js

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

// 1. CORS 설정을 위한 Origin 결정
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://helpful-brigadeiros-517905.netlify.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

// OPTIONS 요청 처리 (CORS Preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// OAuth2Client 설정
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI // Vercel에 설정된 Netlify 콜백 주소
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { idToken, accessToken, code } = body;

    let payload;

    // 🔍 1. 구글로부터 사용자 정보 가져오기 (code, idToken, accessToken 순서로 확인)
    if (code) {
      // ✅ [중요] getToken 호출 시 redirect_uri는 환경 변수에 등록된 값과 반드시 일치해야 합니다.
      const { tokens } = await client.getToken({
        code: code,
        redirect_uri: 'https://helpful-brigadeiros-517905.netlify.app/auth/google/callback'
      });

      client.setCredentials(tokens);

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) throw new Error('구글 사용자 정보 획득 실패');
      const userInfo = await userInfoResponse.json();
      
      payload = {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        sub: userInfo.id,
      };
    } else if (idToken) {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else if (accessToken) {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoResponse.ok) throw new Error('Access Token 정보 확인 실패');
      const userInfo = await userInfoResponse.json();
      payload = {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        sub: userInfo.id,
      };
    } else {
      return NextResponse.json({ message: "인증 정보가 없습니다." }, { status: 400, headers: corsHeaders });
    }

    // 🔍 2. 유저 확인 및 가입 처리
    let user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      const firstName = payload.given_name || payload.name?.split(' ')[0] || 'User';
      const lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '';
      
      user = await prisma.user.create({
        data: {
          email: payload.email,
          firstName: firstName,
          lastName: lastName || firstName,
          nickname: payload.name || payload.email.split('@')[0],
          image: payload.picture,
          provider: 'google',
          providerId: payload.sub,
        },
      });
    }

    // 🔍 3. JWT 발급 및 응답
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const response = NextResponse.json(
      { message: "구글 로그인 성공", user },
      { status: 200, headers: corsHeaders }
    );
    
    // 쿠키 설정
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: true, // 배포 환경이므로 true
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;

  } catch (error) {
    console.error("Google Auth Final Error:", error);
    // 에러 발생 시에도 CORS 헤더를 포함해야 프론트엔드에서 에러 메시지를 읽을 수 있습니다.
    return NextResponse.json(
      { message: "인증 실패", details: error.message }, 
      { status: 401, headers: corsHeaders }
    );
  }
}