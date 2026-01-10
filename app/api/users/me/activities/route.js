// app/api/users/me/activities/route.js

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// ✅ 환경 변수 적용: 등록하신 Netlify 주소를 우선적으로 참조합니다.
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401, headers: corsHeaders });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // 1. 내가 쓴 게시글 댓글 가져오기 (게시글 제목 포함)
    const comments = await prisma.comment.findMany({
      where: { authorId: userId },
      include: {
        article: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. 내가 쓴 상품 문의 가져오기 (상품 이름 포함)
    const qas = await prisma.productqa.findMany({
      where: { authorId: userId },
      include: {
        product: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ comments, qas }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("[USER_ACTIVITY_ERROR]", error);
    return NextResponse.json({ message: "데이터 로드 실패" }, { status: 500, headers: corsHeaders });
  }
}