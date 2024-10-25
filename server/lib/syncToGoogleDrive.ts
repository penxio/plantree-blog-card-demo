import {
  GOOGLE_DRIVE_FOLDER_PREFIX,
  REFRESH_GOOGLE_DRIVE_OAUTH_TOKEN_URL,
} from '@/lib/constants'
import { GoogleDrive } from '@/lib/google-drive'
import { prisma } from '@/lib/prisma'
import { GoogleInfo } from '@/lib/types'
import { Post, User } from '@prisma/client'
import ky from 'ky'

export async function syncToGoogleDrive(
  userId: string,
  post: Post,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return
  const token = await getAccessToken(user)
  if (!token) return
  console.log('====token:', token)
  const drive = new GoogleDrive(token)

  const baseFolderId = await drive.getOrCreateFolder(
    GOOGLE_DRIVE_FOLDER_PREFIX + '-raws',
  )

  const fileName = `post-${post.id}.json`

  let files = await drive.searchFilesByPath(baseFolderId, fileName)
  if (!files.length) {
    await drive.createJSON(fileName, post, baseFolderId)
  } else {
    await drive.updateJsonContent(files[0].id, post)
  }

  console.log('======baseFolderId:', baseFolderId)
}

async function getAccessToken(user: User) {
  const googleInfo = user.google as GoogleInfo
  if (!googleInfo) return null
  // console.log('========googleInfo:', googleInfo)
  const isExpired = googleInfo.expiry_date < Date.now()
  console.log('======isExpired:', isExpired)

  if (!isExpired) {
    return googleInfo.access_token
  }

  const tokenInfo = await ky
    .get(
      REFRESH_GOOGLE_DRIVE_OAUTH_TOKEN_URL +
        `?refresh_token=${googleInfo.refresh_token}`,
    )
    .json<GoogleInfo>()

  await prisma.user.update({
    where: { id: user.id },
    data: { google: tokenInfo },
  })

  return tokenInfo.access_token as string
}
