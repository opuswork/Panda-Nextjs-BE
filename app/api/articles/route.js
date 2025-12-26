// /app/api/articles/route.js (App Router Proxy)
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// This function handles GET requests to /api/articles
export async function GET(request) {
  try {
    // 1. Extract query parameters from the request
    const { searchParams } = new URL(request.url);

    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '10';
    const orderBy = searchParams.get('orderBy') || 'recent';
    const keyword = searchParams.get('keyword') || '';
    
    const where = keyword
      ? { title: { contains: keyword, mode: 'insensitive' } }
      : {};

    const articles = await prisma.article.findMany({
      where,
      orderBy:
        orderBy === 'recent'
          ? { createdAt: 'desc' }
          : { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json(articles);

    // // 2. Build the external API URL with query parameters
    // const externalApiUrl = new URL('http://localhost:3000/articles');
    // externalApiUrl.searchParams.set('page', page);
    // externalApiUrl.searchParams.set('pageSize', pageSize);
    // if (orderBy) {
    //   externalApiUrl.searchParams.set('orderBy', orderBy);
    // }
    // if (keyword) {
    //   externalApiUrl.searchParams.set('keyword', keyword);
    // }
    
    // console.log('[API Route] Fetching articles from backend:', externalApiUrl.toString());
    
    // // 3. Fetch data from your separate backend server on port 3000
    // const backendResponse = await fetch(externalApiUrl.toString()); 
    
    // // Check if the backend response was successful
    // if (!backendResponse.ok) {
    //   // Return the backend's status/error to the client
    //   return new NextResponse(
    //     JSON.stringify({ message: 'Backend API error during fetch' }), 
    //     { status: backendResponse.status }
    //   );
    // }

    // const data = await backendResponse.json();
    
    // // 4. Return the data back to the Next.js frontend component
    // return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

// POST: Forward the "Create" request to port 3000
export async function POST(request) {
  try {

    const body = await request.json();

    const article = await prisma.article.create({
      data: body,
    });

    return NextResponse.json(article, { status: 201 });

    // const body = await request.json();
    
    // // Forward to backend
    // const res = await fetch('http://localhost:3000/articles', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(body),
    // });

    // if (!res.ok) {
    //     throw new Error('Backend failed');
    // }

    // const data = await res.json();
    // return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Failed to create article' },
      { status: 500 }
    );    
    // return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
  }
}