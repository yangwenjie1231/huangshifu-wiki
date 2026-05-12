// 通知创建、浏览历史、搜索关键词计数

import { Prisma } from '@prisma/client';
import { prisma } from './config';
import { normalizeKeyword } from './parsers';
import type { BrowsingTargetType, NotificationType } from '../types';

export function toNotificationResponse(notification: {
  id: string;
  userUid: string;
  type: NotificationType;
  payload: unknown;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    userUid: notification.userUid,
    type: notification.type,
    payload: notification.payload,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function createNotification(userUid: string, type: NotificationType, payload: Record<string, unknown>) {
  try {
    await prisma.notification.create({
      data: {
        userUid,
        type,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error('Create notification error:', error);
  }
}

export async function recordBrowsingHistory(userUid: string, targetType: BrowsingTargetType, targetId: string) {
  const dedupeAfter = new Date(Date.now() - 30 * 60 * 1000);
  try {
    const existing = await prisma.browsingHistory.findFirst({
      where: {
        userUid,
        targetType,
        targetId,
        createdAt: {
          gte: dedupeAfter,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      await prisma.browsingHistory.create({
        data: {
          userUid,
          targetType,
          targetId,
        },
      });
    }
  } catch (error) {
    console.error('Record browsing history error:', error);
  }
}

export async function increaseSearchKeywordCount(rawKeyword: string) {
  const keyword = normalizeKeyword(rawKeyword);
  if (!keyword) return;

  try {
    await prisma.searchKeyword.upsert({
      where: { keyword },
      update: {
        count: {
          increment: 1,
        },
      },
      create: {
        keyword,
        count: 1,
      },
    });
  } catch (error) {
    console.error('Increase search keyword count error:', error);
  }
}
