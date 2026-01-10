import { NextResponse } from 'next/server';
// import { writeFile, mkdir } from 'fs/promises'; // ❌ Vercel Blob 사용으로 불필요
import { extname } from 'path'; 
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob'; // ✅ Vercel Blob 추가

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
// import fs from 'fs'; // ❌ 로컬 파일 시스템 주석 처리
import path from 'path';

// CORS 헤더 설정 (배포 시에는 Netlify 주소로 변경 권장)
const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/products 로직 (기존과 동일)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 1);
    const pageSize = Number(searchParams.get('pageSize') ?? 10);
    const orderBy = searchParams.get('orderBy') ?? 'recent';
    const keyword = searchParams.get('keyword') ?? '';

    const skip = (page - 1) * pageSize;
    const where = keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { description: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : {};

    const orderByClause = orderBy === 'price' ? { price: 'asc' } : { createdAt: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: orderByClause,
        include: { tags: true },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json(
      {
        items: products,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] GET products failed:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 상품 등록 API (POST) - Vercel Blob 적용 버전
 */
export async function POST(request) {
  try {
    // 1. 인증 확인
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401, headers: corsHeaders });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // 2. FormData 읽기
    const formData = await request.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const category = formData.get('category');
    const price = parseFloat(formData.get('price'));
    const stock = parseInt(formData.get('stock'));
    const tags = JSON.parse(formData.get('tags') || '[]');
    const imageFile = formData.get('image');

    // 3. 판매자 정보 추출
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true, firstName: true, lastName: true }
    });
    const sellerDisplayName = user.nickname || `${user.lastName}${user.firstName}`;

    // 4. 이미지 저장 처리 (Vercel Blob 방식)
    let imagePath = null;
    let originalFileName = null;

    if (imageFile && imageFile instanceof File) {
      originalFileName = imageFile.name;
      const fileExtension = path.extname(originalFileName);
      // 파일명 생성 (Base64 인코딩 포함 유지)
      const fileName = `${Buffer.from(originalFileName).toString('base64').substring(0, 8)}_${Date.now()}${fileExtension}`;
      
      /* ❌ 기존 로컬 저장 로직 (주석 처리)
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, fileName);
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      imagePath = `/uploads/products/${fileName}`;
      */

      // ✅ Vercel Blob으로 업로드 실행
      const blob = await put(`products/${fileName}`, imageFile, {
        access: 'public', // 외부에서 URL로 접근 가능하게 설정
        addRandomSuffix: true, // 파일명 중복 방지 추가 보안
      });

      // DB에는 Vercel에서 제공하는 영구 URL 저장
      imagePath = blob.url;
    }

    // 5. DB에 상품 저장
    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        category,
        price,
        stock,
        image: imagePath, // ✅ 이제 URL이 저장됩니다.
        originalFileName: originalFileName,
        sellerId: userId,
        sellerName: sellerDisplayName,
        tags: {
          create: tags.map(tagName => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName }
              }
            }
          }))
        }
      }
    });

    return NextResponse.json(newProduct, { status: 201, headers: corsHeaders });

  } catch (error) {
    console.error("[PRODUCT_POST_ERROR]", error);
    return NextResponse.json(
      { message: "상품 등록 중 오류가 발생했습니다.", error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}