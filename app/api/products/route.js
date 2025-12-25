// app/api/products/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/products
 * Supports pagination, keyword search, ordering
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

    const orderByClause =
      orderBy === 'price'
        ? { price: 'asc' }
        : { createdAt: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: orderByClause,
        include: {
          tags: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json(
      {
        items: products,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('[API] GET products failed:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, description, price, imageUrl, tagIds = [] } = body;

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        imageUrl,
        tags: {
          connect: tagIds.map(id => ({ id })),
        },
      },
    });

    return NextResponse.json(product, { status: 201 });

  } catch (error) {
    console.error('[API] POST product failed:', error);
    return NextResponse.json(
      { message: 'Failed to create product' },
      { status: 500 }
    );
  }
}
