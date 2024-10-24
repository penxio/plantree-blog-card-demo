import { getSession } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import mime from 'mime'
import { NextResponse } from 'next/server'

// export const runtime = 'edge'

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response(
      "Missing BLOB_READ_WRITE_TOKEN. Don't forget to add that to your .env file.",
      {
        status: 401,
      },
    )
  }

  const session = await getSession()

  if (!session) {
    throw new Error('Session not found')
  }

  const url = new URL(req.url)
  const hash = url.searchParams.get('fileHash')

  // console.log('>>>>>>hash:', hash)

  const file = req.body!

  const contentType = req.headers.get('content-type') || 'text/plain'
  const ext = mime.getExtension(contentType)

  const filename = `${hash}.${ext}`
  const result = await put(filename, file, {
    contentType,
    access: 'public',
    addRandomSuffix: false,
  })

  console.log('======result:', result)

  await prisma.asset.create({
    data: {
      url: result.url,
      type: contentType,
    },
  })

  return NextResponse.json(result)
}
