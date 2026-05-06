/**
 * API Proxy Route
 * Forwards all requests to the backend API, avoiding CORS issues
 * Frontend → Next.js API Route → Backend API
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const url = `${BACKEND_URL}${path}`;

  try {
    console.log(`🔄 Proxy GET: ${url}`);
    
    const headers = new Headers();
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers.set('authorization', authHeader);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const data = await response.text();
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`❌ Proxy Error:`, error);
    return NextResponse.json(
      { error: `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const url = `${BACKEND_URL}${path}`;

  try {
    console.log(`🔄 Proxy POST: ${url}`);
    
    const body = await request.text();
    const headers = new Headers();
    
    headers.set('Content-Type', 'application/json');
    
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers.set('authorization', authHeader);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.text();
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`❌ Proxy Error:`, error);
    return NextResponse.json(
      { error: `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const url = `${BACKEND_URL}${path}`;

  try {
    console.log(`🔄 Proxy PUT: ${url}`);
    
    const body = await request.text();
    const headers = new Headers();
    
    headers.set('Content-Type', 'application/json');
    
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers.set('authorization', authHeader);
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body,
    });

    const data = await response.text();
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`❌ Proxy Error:`, error);
    return NextResponse.json(
      { error: `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
