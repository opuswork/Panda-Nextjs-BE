

// app/api/articles/[articleId]/favorite/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 💡 반드시 'export' 키워드가 있어야 합니다!
 */
export async function POST(request, { params }) {
  try {
    const { articleId } = await params;

    console.log(`[Favorite API] Increasing count for article: ${articleId}`);

    // prisma가 정상적으로 로드되었다면 이제 .article에 접근 가능합니다.
    const updatedArticle = await prisma.article.update({
      where: { id: articleId },
      data: {
        favoriteCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({ 
      success: true, 
      favoriteCount: updatedArticle.favoriteCount 
    });
  } catch (error) {
    console.error("[Favorite API] Error:", error);
    return NextResponse.json(
      { error: "좋아요 처리에 실패했습니다." }, 
      { status: 500 }
    );
  }
}