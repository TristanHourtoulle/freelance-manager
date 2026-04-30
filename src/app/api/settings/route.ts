import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { settingsUpdateSchema } from "@/lib/schemas/settings"
import { decrypt, maskToken } from "@/lib/encryption"

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    })

    let linearTokenPreview: string | null = null
    if (settings.linearApiTokenEncrypted && settings.linearApiTokenIv) {
      try {
        const plain = decrypt(
          Buffer.from(settings.linearApiTokenEncrypted),
          Buffer.from(settings.linearApiTokenIv),
        )
        linearTokenPreview = maskToken(plain)
      } catch (e) {
        console.warn("[settings] could not decrypt Linear token", e)
      }
    }

    return NextResponse.json({
      defaultCurrency: settings.defaultCurrency,
      defaultPaymentDays: settings.defaultPaymentDays,
      defaultRate: decimalToNumber(settings.defaultRate) ?? 0,
      hasLinearToken: Boolean(settings.linearApiTokenEncrypted),
      linearTokenPreview,
      linearLastSyncedAt: settings.linearLastSyncedAt?.toISOString() ?? null,
    })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function PATCH(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const data = settingsUpdateSchema.parse(await req.json())
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
