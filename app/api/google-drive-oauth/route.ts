import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const access_token = url.searchParams.get('access_token')
  const refresh_token = url.searchParams.get('refresh_token')
  const expiry_date = url.searchParams.get('expiry_date')
  const address = url.searchParams.get('address')

  if (!access_token || !refresh_token || !expiry_date || !address) {
    return NextResponse.redirect('/error') // Handle error accordingly
  }

  await prisma.user.update({
    where: { address },
    data: {
      google: {
        access_token,
        refresh_token,
        expiry_date,
      },
    },
  })

  return NextResponse.redirect(new URL('/~/backup', req.url))
}
