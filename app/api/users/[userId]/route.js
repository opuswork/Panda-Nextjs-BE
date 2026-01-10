// app/api/users/[userId]/route.js

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// ✅ 서버리스 환경(Vercel)에서는 로컬 파일 시스템(fs) 사용이 제한되므로 
// 이미 Vercel Blob으로 전환하셨다면 관련 import는 정리하셔도 좋습니다.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ 환경 변수 적용
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, PUT, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * 특정 유저의 상세 정보를 조회하는 API (GET)
 */
export async function GET(request, { params }) {
  try {
    const { userId } = await params;

    if (!userId || userId === 'me' || userId === 'undefined') {
      return NextResponse.json(
        { message: "유효하지 않은 유저 ID입니다." }, 
        { status: 400, headers: corsHeaders }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        nickname: true,
        firstName: true,
        lastName: true,
        image: true,
        originalFileName: true,
        createdAt: true,
        address: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "해당 유저를 찾을 수 없습니다." }, 
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(user, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error(`[GET_USER_DETAIL ERROR]:`, error);
    return NextResponse.json(
      { message: "서버 내부 오류가 발생했습니다.", error: error.message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * 특정 유저 정보 수정 - 이미지 포함 (PATCH)
 * 새로운 이미지 업로드 시 기존 파일 삭제 로직 포함
 */
export async function PATCH(request, { params }) {
  try {
    const { userId } = await params;
    
    // 1. 인증 확인
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "인증 토큰이 없습니다." }, { status: 401, headers: corsHeaders });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.userId !== userId) {
      return NextResponse.json({ message: "본인의 정보만 수정할 수 있습니다." }, { status: 403, headers: corsHeaders });
    }

    // 2. 기존 유저 정보를 조회 (기존 이미지 경로 확인용)
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true }
    });

    // 3. FormData 파싱
    const formData = await request.formData();
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const nickname = formData.get('nickname') || null;
    const email = formData.get('email');
    const phoneNumber = formData.get('phoneNumber') || null;
    const address = formData.get('address') || null;
    const imageFile = formData.get('image');

    const updateData = { firstName, lastName, nickname, email, phoneNumber, address };
    // 4. 이미지 처리 및 기존 파일 삭제
    if (imageFile && imageFile instanceof File) {
      
      // ✅ [추가] 기존 이미지가 서버에 있다면 삭제
      if (currentUser?.image) {
        // DB에 저장된 경로 (/uploads/...)를 물리적 경로로 변환
        const oldFilePath = path.join(process.cwd(), 'public', currentUser.image);
        
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
            console.log("✅ 기존 이미지 파일 삭제 완료:", oldFilePath);
          } catch (unlinkError) {
            console.error("❌ 기존 이미지 삭제 실패 (무시하고 계속 진행):", unlinkError);
          }
        }
      }

      const originalFileName = imageFile.name;
      const fileExtension = path.extname(originalFileName);
      // 파일명 중복 방지를 위해 타임스탬프 추가
      const base64FileName = Buffer.from(originalFileName).toString('base64').substring(0, 10) + Date.now() + fileExtension;
      
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'users', 'profile');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, base64FileName);
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);
      
      updateData.image = `/uploads/users/profile/${base64FileName}`;
      updateData.originalFileName = originalFileName;
    }

    // 5. DB 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json(
      { message: "성공적으로 수정되었습니다.", user: updatedUser }, 
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("[PATCH_USER ERROR]", error);
    return NextResponse.json(
      { message: "수정 중 오류가 발생했습니다.", error: error.message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}