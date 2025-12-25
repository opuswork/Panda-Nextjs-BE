
// app/api/auth/logout/route.js

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out' });

  response.cookies.set({
    name: 'auth_token',
    value: '',
    path: '/',
    maxAge: 0,
  });

  return response;
}
