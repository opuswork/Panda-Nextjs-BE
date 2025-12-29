import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // This tests if Netlify can reach Vercel
    const res = await fetch('https://panda-nextjs-be.vercel.app/api/products');
    
    if (res.ok) {
      return NextResponse.json({ 
        status: "success", 
        message: "FE (Netlify) successfully reached BE (Vercel)" 
      });
    } else {
      throw new Error(`BE returned status: ${res.status}`);
    }
  } catch (error) {
    return NextResponse.json({ 
      status: "error", 
      message: "FE could not reach BE",
      details: error.message 
    }, { status: 500 });
  }
}