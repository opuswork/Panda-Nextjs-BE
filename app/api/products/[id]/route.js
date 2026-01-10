import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

/**
 * [공통 유틸리티] 이미지 물리적 파일 삭제
 */
async function deletePhysicalFile(imagePath) {
  if (!imagePath) return;
  try {
    const filePath = join(process.cwd(), 'public', imagePath);
    await unlink(filePath);
    console.log(`[Cleanup] Deleted file: ${filePath}`);
  } catch (err) {
    console.error(`[Cleanup] Failed to delete file: ${imagePath}`, err.message);
  }
}

/**
 * GET: 상품 상세 조회
 * - 스키마에 정의된 'seller' 관계를 사용합니다.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        // ✅ [수정] owner -> seller (스키마 필드명 일치)
        seller: {
          select: {
            id: true,
            nickname: true,
            image: true,
          }
        }
      },
    });

    if (!product) {
      return NextResponse.json({ message: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    console.error('[API] GET product failed:', error);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * PATCH: 상품 수정
 * - sellerId를 통해 본인 확인을 수행합니다.
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    console.log("[PATCh] Product ID:", id);
    // 1. 인증 확인
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    console.log("[PATCh] Token:", token);
    if (!token) return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // 2. 기존 상품 조회 및 권한 확인
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ message: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    // ✅ [수정] ownerId -> sellerId (스키마 필드명 일치)
    if (existingProduct.sellerId !== userId) {
      return NextResponse.json({ message: "수정 권한이 없습니다." }, { status: 403 });
    }

    const formData = await request.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const category = formData.get('category');
    const price = formData.get('price') ? parseFloat(formData.get('price')) : undefined;
    const stock = formData.get('stock') ? parseInt(formData.get('stock'), 10) : undefined;
    const imageFile = formData.get('image'); 
    
    const rawTags = formData.get('tags');
    const tags = rawTags ? JSON.parse(rawTags) : undefined;

    let updateData = { name, description, category, price, stock };
    
    // 3. 새 이미지 업로드 처리
    if (imageFile && typeof imageFile !== 'string') {
      if (existingProduct.image) {
        await deletePhysicalFile(existingProduct.image);
      }

      const originalFileName = imageFile.name;
      const fileExtension = extname(originalFileName);
      const storedFileName = `${randomUUID()}${fileExtension}`;
      
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const filePath = join(process.cwd(), 'public', 'uploads', storedFileName);
      
      await writeFile(filePath, buffer);
      updateData.image = `/uploads/${storedFileName}`;
      updateData.originalFileName = originalFileName;
    }

    // 4. DB 업데이트
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...updateData,
        tags: tags ? {
          deleteMany: {},
          create: tags.map(tagName => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName }
              }
            }
          }))
        } : undefined
      },
      include: { tags: { include: { tag: true } } }
    });

    return NextResponse.json(updatedProduct, { status: 200 });
  } catch (error) {
    console.error('[API] PATCH product failed:', error);
    return NextResponse.json({ message: '상품 수정 실패' }, { status: 500 });
  }
}

/**
 * DELETE: 상품 삭제
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // 1. 인증 확인
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // 2. 상품 조회 및 권한 확인
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return NextResponse.json({ message: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    // ✅ [수정] ownerId -> sellerId (스키마 필드명 일치)
    if (product.sellerId !== userId) {
      return NextResponse.json({ message: "삭제 권한이 없습니다." }, { status: 403 });
    }

    // 3. 물리적 이미지 파일 삭제
    if (product.image) {
      await deletePhysicalFile(product.image);
    }

    // 4. DB 삭제 실행
    await prisma.product.delete({
      where: { id }
    });

    return NextResponse.json({ message: "상품이 삭제되었습니다." }, { status: 200 });

  } catch (error) {
    console.error("[PRODUCT_DELETE_ERROR]", error);
    return NextResponse.json({ message: "삭제 중 오류 발생" }, { status: 500 });
  }
}