import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// CORS 설정을 위한 공통 헤더
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://helpful-brigadeiros-517905.netlify.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

/**
 * OPTIONS: CORS 프리플라이트 요청 처리
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * 1. 댓글 목록 조회 (GET)
 */
export async function GET(request, context) {
  try {
    const params = await context.params;
    const { articleId } = params;

    const comments = await prisma.comment.findMany({
      where: { articleId: articleId },
      include: {
        // ✅ 작성자 관계 이름을 authorUser로 통일했습니다.
        authorUser: {
          select: {
            nickname: true,
            firstName: true,
            lastName: true,
            image: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(comments, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("[COMMENT_GET_ERROR]", error);
    return NextResponse.json({ error: "댓글 조회 실패" }, { status: 500, headers: corsHeaders });
  }
}

/**
 * 2. 댓글 등록 (POST)
 */
export async function POST(request, context) {
  try {
    const params = await context.params;
    const { articleId } = params; 

    // 인증 확인
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "인증 필요" }, { status: 401, headers: corsHeaders });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400, headers: corsHeaders });
    }

    // DB 저장
    const newComment = await prisma.comment.create({
      data: {
        content,
        articleId: articleId, 
        authorId: decoded.userId, // JWT 토큰의 유저 ID 저장
      },
      include: {
        // ✅ [수정] author -> authorUser (스키마 변경사항 반영)
        authorUser: {
          select: { 
            nickname: true, 
            image: true 
          }
        }
      }
    });

    return NextResponse.json(newComment, { status: 201, headers: corsHeaders });

  } catch (error) {
    console.error("[COMMENT_POST_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}