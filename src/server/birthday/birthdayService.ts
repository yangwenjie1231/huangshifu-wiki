import { prisma } from '../prisma';

export interface BirthdayConfigInput {
  type: string;
  title: string;
  content: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function getAllBirthdayConfigs() {
  return prisma.birthdayConfig.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getBirthdayConfigsByType(type: string) {
  return prisma.birthdayConfig.findMany({
    where: { type, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createBirthdayConfig(data: BirthdayConfigInput) {
  return prisma.birthdayConfig.create({
    data: {
      ...data,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateBirthdayConfig(id: string, data: Partial<BirthdayConfigInput>) {
  return prisma.birthdayConfig.update({
    where: { id },
    data,
  });
}

export async function deleteBirthdayConfig(id: string) {
  return prisma.birthdayConfig.delete({
    where: { id },
  });
}

export async function toggleBirthdayConfigActive(id: string) {
  const config = await prisma.birthdayConfig.findUnique({ where: { id } });
  if (!config) throw new Error('Config not found');
  return prisma.birthdayConfig.update({
    where: { id },
    data: { isActive: !config.isActive },
  });
}
