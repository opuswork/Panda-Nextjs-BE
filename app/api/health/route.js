import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Check if the Prisma client is initialized
    if (!prisma) {
      throw new Error("Prisma client not initialized");
    }

    // 2. Try a simple database query (counting products)
    const productCount = await prisma.product.count();

    return NextResponse.json({
      status: "online",
      database: "connected",
      message: "Netlify can talk to Neon!",
      count: productCount,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error("Health Check Failed:", error);
    
    return NextResponse.json({
      status: "error",
      database: "disconnected",
      error: error.message,
    }, { status: 500 });
  }
}