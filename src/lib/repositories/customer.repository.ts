/**
 * Customer Repository — 고객사 데이터 접근 계층
 */
import { prisma } from "@/lib/db";
import type { PaginatedResult } from "./types";

export interface CustomerListFilter {
  search?: string;
  serviceTypeId?: number;
  salesTeam?: string;
  page?: number;
  limit?: number;
}

export interface CreateCustomerData {
  companyName: string;
  serviceTypeId: number;
  contactName?: string | null;
  contactTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  salesRep?: string | null;
  salesTeam?: string | null;
  ecoScore?: number | null;
  notes?: string | null;
}

export type UpdateCustomerData = Partial<CreateCustomerData>;

export const customerRepository = {
  /** 고객사 목록 조회 (페이지네이션 + 검색) */
  async findMany(
    filter: CustomerListFilter = {}
  ): Promise<PaginatedResult<unknown>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };

    if (filter.search) {
      where.OR = [
        { companyName: { contains: filter.search, mode: "insensitive" } },
        { contactName: { contains: filter.search, mode: "insensitive" } },
        { salesRep: { contains: filter.search, mode: "insensitive" } },
      ];
    }
    if (filter.serviceTypeId) {
      where.serviceTypeId = filter.serviceTypeId;
    }
    if (filter.salesTeam) {
      where.salesTeam = { contains: filter.salesTeam, mode: "insensitive" };
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { serviceType: true },
        orderBy: { companyName: "asc" },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items: customers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /** 고객사 단건 조회 */
  async findById(id: number) {
    return prisma.customer.findUnique({
      where: { id },
      include: { serviceType: true },
    });
  },

  /** 고객사 생성 */
  async create(data: CreateCustomerData) {
    return prisma.customer.create({
      data: {
        companyName: data.companyName,
        contactName: data.contactName || null,
        contactTitle: data.contactTitle || null,
        email: data.email || null,
        phone: data.phone || null,
        serviceTypeId: data.serviceTypeId,
        salesRep: data.salesRep || null,
        salesTeam: data.salesTeam || null,
        ecoScore: data.ecoScore || null,
        notes: data.notes || null,
      },
      include: { serviceType: true },
    });
  },

  /** 고객사 수정 */
  async update(id: number, data: UpdateCustomerData) {
    return prisma.customer.update({
      where: { id },
      data: {
        companyName: data.companyName,
        contactName: data.contactName ?? undefined,
        contactTitle: data.contactTitle ?? undefined,
        email: data.email ?? undefined,
        phone: data.phone ?? undefined,
        serviceTypeId: data.serviceTypeId ?? undefined,
        salesRep: data.salesRep ?? undefined,
        salesTeam: data.salesTeam ?? undefined,
        ecoScore: data.ecoScore ?? undefined,
        notes: data.notes ?? undefined,
      },
      include: { serviceType: true },
    });
  },

  /** 고객사 소프트 삭제 */
  async softDelete(id: number) {
    return prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
