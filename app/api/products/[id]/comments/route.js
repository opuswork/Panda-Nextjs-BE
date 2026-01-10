// app/api/products/[id]/comments/route.js

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// ✅ 환경 변수 사용: 배포 시에는 Netlify 주소를, 로컬에선 3000번을 바라봅니다.
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
 * POST: 새로운 상품 문의(댓글) 등록
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params; // URL의 [id] (productId) 추출
    
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "인증 실패" }, { status: 401, headers: corsHeaders });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ message: "내용을 입력해주세요." }, { status: 400, headers: corsHeaders });
    }

    // 1. DB 저장 및 생성된 데이터 반환
    const newQa = await prisma.productqa.create({
      data: {
        content: content,
        productId: id, 
        authorId: decoded.userId, // ✅ 스키마의 authorId 필드 사용
      },
      include: {
        // ✅ 등록 직후 화면에 바로 닉네임을 보여주기 위해 관계 데이터 포함
        authorUser: { 
          select: { 
            nickname: true, 
            firstName: true, 
            lastName: true,
            image: true 
          }
        }
      }
    });

    return NextResponse.json(newQa, { status: 201, headers: corsHeaders });

  } catch (error) {
    console.error("[PRODUCT_QA_POST_ERROR]", error);
    return NextResponse.json(
      { message: "등록 중 오류 발생", error: error.message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET: 해당 상품의 모든 문의 목록 조회
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const qas = await prisma.productqa.findMany({
      where: { productId: id },
      include: {
        // ✅ 스키마의 authorUser 관계를 조인해서 사용자 정보(닉네임, 이미지 등)를 가져옵니다.
        authorUser: {
          select: {
            nickname: true,
            firstName: true,
            lastName: true,
            image: true 
          }
        }
      },
      orderBy: { createdAt: 'desc' } // 최신순 정렬
    });

    return NextResponse.json(qas, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("[PRODUCT_QA_GET_ERROR]", error);
    return NextResponse.json(
      { message: "조회 오류", error: error.message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}