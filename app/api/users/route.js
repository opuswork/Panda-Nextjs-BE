// app/api/users/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    const email = (body?.email || "").trim().toLowerCase();
    const password = body?.password || "";
    const firstName = (body?.firstName || "").trim();
    const lastName = (body?.lastName || "").trim();
    const nickname = (body?.nickname || "").trim() || null;

    // 1) Validate input
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { message: "Email, password, firstName, and lastName are required" },
        { status: 400 }
      );
    }

    // Optional: basic password sanity check (adjust as you want)
    if (password.length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // 2) Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { message: "Email already exists" },
        { status: 409 }
      );
    }

    // 3) Hash password (expects plaintext from frontend)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4) Create user (+ preference)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        nickname,
        preference: {
          create: { receiveEmail: false },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        nickname: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("[API] User creation failed:", error);

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
