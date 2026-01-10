// app/api/auth/login/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Optional: helps avoid caching surprises in some environments
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body?.email || "").trim().toLowerCase();
    const password = body?.password || "";

    // 1) Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    // 2) Validate server config
    if (!process.env.JWT_SECRET) {
      console.error("[LOGIN ERROR] Missing JWT_SECRET env var");
      return NextResponse.json(
        { message: "Server misconfigured: JWT_SECRET is missing" },
        { status: 500 }
      );
    }

    // 3) Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 4) Compare password (expects plaintext from client)
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 5) Sign JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // 6) Respond + set cookie
    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
    });

    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("[LOGIN ERROR]", error);

    // Keep response safe, but still useful in dev
    return NextResponse.json(
      {
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "production"
            ? undefined
            : error?.message || String(error),
        code: error?.code,
      },
      { status: 500 }
    );
  }
}
