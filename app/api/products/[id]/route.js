// /app/api/products/[id]/route.js (App Router Proxy for individual product operations)

import { NextResponse } from 'next/server';

// This function handles PATCH requests to /api/products/[id]
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    
    // 1. Get the request body
    const body = await request.json();
    
    // 2. Forward the PATCH request to your separate backend server on port 3001
    const externalApiUrl = `http://localhost:3001/products/${id}`;
    
    const backendResponse = await fetch(externalApiUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    // Check if the backend response was successful
    if (!backendResponse.ok) {
      // Return the backend's status/error to the client
      const errorText = await backendResponse.text();
      return new NextResponse(
        JSON.stringify({ message: errorText || 'Backend API error during PATCH' }), 
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    
    // 3. Return the data back to the Next.js frontend component
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error("Proxy PATCH failed:", error);
    // 4. Return a generic server error if the fetch itself failed
    return new NextResponse(
      JSON.stringify({ message: 'Internal Server Error in Next.js proxy' }), 
      { status: 500 }
    );
  }
}

// This function handles DELETE requests to /api/products/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    // 1. Forward the DELETE request to your separate backend server on port 3001
    const externalApiUrl = `http://localhost:3001/products/${id}`;
    
    const backendResponse = await fetch(externalApiUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Check if the backend response was successful
    if (!backendResponse.ok) {
      // Return the backend's status/error to the client
      const errorText = await backendResponse.text();
      return new NextResponse(
        JSON.stringify({ message: errorText || 'Backend API error during DELETE' }), 
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json().catch(() => ({}));
    
    // 3. Return the data back to the Next.js frontend component
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error("Proxy DELETE failed:", error);
    // 4. Return a generic server error if the fetch itself failed
    return new NextResponse(
      JSON.stringify({ message: 'Internal Server Error in Next.js proxy' }), 
      { status: 500 }
    );
  }
}

// This function handles GET requests to /api/products/[id]
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    // 1. Fetch data from your separate backend server on port 3001
    const externalApiUrl = `http://localhost:3001/products/${id}`;
    
    const backendResponse = await fetch(externalApiUrl);
    
    // Check if the backend response was successful
    if (!backendResponse.ok) {
      // Return the backend's status/error to the client
      return new NextResponse(
        JSON.stringify({ message: 'Backend API error during fetch' }), 
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    
    // 2. Return the data back to the Next.js frontend component
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error("Proxy GET failed:", error);
    // 3. Return a generic server error if the fetch itself failed
    return new NextResponse(
      JSON.stringify({ message: 'Internal Server Error in Next.js proxy' }), 
      { status: 500 }
    );
  }
}

