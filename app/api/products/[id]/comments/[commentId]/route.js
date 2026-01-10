// app/api/products/[id]/comments/[commentId]/route.js

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export const runtime = 'nodejs';

// ✅ 환경 변수에서 프론트엔드 주소를 가져오고, 없으면 로컬 주소를 사용합니다.
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://helpful-brigadeiros-517905.netlify.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

/**
 * OPTIONS: CORS 프리플라이트 대응
 * - 브라우저가 PATCH, DELETE 요청 전 권한을 확인할 때 사용됩니다.
 */
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

/**
 * 1. 특정 문의 수정 (PATCH)
 * - 본인 확인 로직 포함
 */
export async function PATCH(request, { params }) {
  try {
    const { commentId } = await params; // URL에서 전달된 값은 문자열임
    const body = await request.json();
    const { content } = body;

    // 인증 확인
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401, headers: corsHeaders });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    if (!content) {
      return NextResponse.json({ error: '수정할 내용을 입력해주세요.' }, { status: 400, headers: corsHeaders });
    }

    // 🔍 데이터 존재 확인 및 권한 체크 (ID 타입 Int로 변환)
    const existingQa = await prisma.productqa.findUnique({
      where: { 
        id: parseInt(commentId, 10) 
      }
    });

    if (!existingQa) {
      return NextResponse.json({ error: '문의글을 찾을 수 없습니다.' }, { status: 404, headers: corsHeaders });
    }

    if (existingQa.authorId !== userId) {
      return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403, headers: corsHeaders });
    }

    // 수정 실행
    const updatedQna = await prisma.productqa.update({
      where: { 
        id: parseInt(commentId, 10) 
      },
      data: { 
        content 
      },
    });

    return NextResponse.json(updatedQna, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[API] QA_PATCH_ERROR:', error);
    return NextResponse.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500, headers: corsHeaders });
  }
}

/**
 * 2. 특정 문의 삭제 (DELETE)
 * - 본인 확인 로직 포함
 */
export async function DELETE(request, { params }) {
  try {
    const { commentId } = await params;

    // 인증 확인
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401, headers: corsHeaders });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // 🔍 데이터 존재 확인 및 권한 체크 (ID 타입 Int로 변환)
    const existingQa = await prisma.productqa.findUnique({
      where: { id: parseInt(commentId, 10) }
    });

    if (!existingQa) {
      return NextResponse.json({ error: '문의글을 찾을 수 없습니다.' }, { status: 404, headers: corsHeaders });
    }

    if (existingQa.authorId !== userId) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403, headers: corsHeaders });
    }

    // 삭제 실행
    await prisma.productqa.delete({
      where: { id: parseInt(commentId, 10) },
    });

    return NextResponse.json({ message: '삭제되었습니다.' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[API] QA_DELETE_ERROR:', error);
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500, headers: corsHeaders });
  }
}