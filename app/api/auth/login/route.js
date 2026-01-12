// app/api/auth/login/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Optional: helps avoid caching surprises in some environments
export const dynamic = "force-dynamic";

// CORS 설정
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://panda-deals.netlify.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body?.email || "").trim().toLowerCase();
    const password = body?.password || "";

    // 1) Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2) Validate server config
    if (!process.env.JWT_SECRET) {
      console.error("[LOGIN ERROR] Missing JWT_SECRET env var");
      return NextResponse.json(
        { message: "Server misconfigured: JWT_SECRET is missing" },
        { status: 500, headers: corsHeaders }
      );
    }

    // 3) Find user (provider도 함께 조회)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, provider: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    // ✅ 구글 로그인으로 가입한 사용자는 일반 로그인 불가
    if (user.provider === 'google' || user.provider === 'kakao') {
      return NextResponse.json(
        { message: `이 이메일은 ${user.provider === 'google' ? '구글' : '카카오'} 로그인으로 가입된 계정입니다. 소셜 로그인을 사용해주세요.` },
        { status: 400, headers: corsHeaders }
      );
    }

    // ✅ password가 null인 경우 처리 (소셜 로그인 사용자)
    if (!user.password) {
      return NextResponse.json(
        { message: "비밀번호가 설정되지 않은 계정입니다. 소셜 로그인을 사용해주세요." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 4) Compare password (expects plaintext from client)
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    // 5) Sign JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // 6) Respond + set cookie
    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
    }, { headers: corsHeaders });

    // ✅ 크로스 도메인 쿠키 설정
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: true, // 배포 환경이므로 true
      sameSite: "none", // 크로스 도메인 쿠키를 위해 'none'
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("[LOGIN ERROR]", error);

    // Keep response safe, but still useful in dev
    return NextResponse.json(
      {
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "production"
            ? undefined
            : error?.message || String(error),
        code: error?.code,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
