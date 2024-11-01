import { GateType, PostStatus } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { syncToGoogleDrive } from '../lib/syncToGoogleDrive'
import { protectedProcedure, publicProcedure, router } from '../trpc'

enum PostType {
  ARTICLE = 'ARTICLE',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  NFT = 'NFT',
  FIGMA = 'FIGMA',
}

export const postRouter = router({
  list: protectedProcedure.query(async ({ ctx, input }) => {
    const posts = await prisma.post.findMany({
      include: {
        postTags: { include: { tag: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return posts
  }),

  publishedPosts: publicProcedure.query(async ({ ctx, input }) => {
    const posts = await prisma.post.findMany({
      where: { postStatus: PostStatus.PUBLISHED },
    })

    return posts
  }),

  byId: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const post = await prisma.post.findUniqueOrThrow({
      include: {
        postTags: { include: { tag: true } },
      },
      where: { id: input },
    })

    syncToGoogleDrive(ctx.token.uid, post as any)
    // console.log('post-------xxxxxxxxxx:', post?.postTags)
    return post
  }),

  create: protectedProcedure
    .input(
      z.object({
        type: z.enum([
          PostType.ARTICLE,
          PostType.IMAGE,
          PostType.VIDEO,
          PostType.AUDIO,
          PostType.NFT,
          PostType.FIGMA,
        ]),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newPost = await prisma.post.create({
        data: {
          userId: ctx.token.uid,
          type: input.type,
        },
      })

      return prisma.post.findUniqueOrThrow({
        where: { id: newPost.id },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, content, ...data } = input

      const post = await prisma.post.update({
        where: { id },
        data: {
          ...data,
          content: content || '',
        },
      })

      return post
    }),

  updateCover: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        image: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, image } = input
      const post = await prisma.post.update({
        where: { id },
        data: { image },
      })

      return post
    }),

  publish: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        gateType: z.enum([GateType.FREE, GateType.PAID]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, gateType } = input
      const post = await prisma.post.update({
        where: { id },
        data: {
          postStatus: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          gateType,
        },
      })

      revalidatePath('/', 'layout')
      // revalidatePath('/(blog)/(home)', 'page')
      revalidatePath('/(blog)/posts', 'page')
      revalidatePath('/(blog)/posts/[...slug]', 'page')
      revalidatePath('/(blog)/posts/page/[page]', 'page')

      // sync
      {
        prisma.post
          .findUnique({
            include: { postTags: { include: { tag: true } } },
            where: { id: post.id },
          })
          .then((post) => {
            syncToGoogleDrive(ctx.token.uid, post as any)
          })
      }

      return post
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const post = await prisma.post.delete({
        where: { id: input },
      })

      return post
    }),
})
