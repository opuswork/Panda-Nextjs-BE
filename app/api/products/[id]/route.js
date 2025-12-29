// /app/api/products/[id]/route.js (App Router Proxy for individual product operations)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET: Retrieve a single product by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params; // Required for Next.js 15+

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        tags: {
          include: {
            tag: true, // Get actual Tag data (name, etc.) through the join table
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    console.error('[API] GET product failed:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH: Update a product's details
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Prevent ID from being changed
    const { id: _, createdAt: __, ...updateData } = body;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedProduct, { status: 200 });
  } catch (error) {
    console.error('[API] PATCH product failed:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Failed to update product' }, { status: 500 });
  }
}

/**
 * DELETE: Remove a product
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Note: If you have dependent records (like ProductTag), 
    // Prisma usually handles them if onUpdate/onDelete is set to Cascade.
    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Product deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('[API] DELETE product failed:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Failed to delete product' }, { status: 500 });
  }
}