import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1")

    return NextResponse.json({
      status: "healthy",
      database: "connected",
    })
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
      },
      { status: 503 },
    )
  }
}
