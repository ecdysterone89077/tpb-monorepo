import { Body, Controller, Delete, Get, Param, Post, Put, Query, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { createHash } from "node:crypto";
import { GalleryInputSchema, StatsSchema, SubscriberInputSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth";
import { parse } from "../zod";
import { parsePagination, paginationMeta } from "../pagination";

@Controller()
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: "up" };
    } catch {
      throw new ServiceUnavailableException({ ok: false, database: "down" });
    }
  }

  // ---------------------------------------------------------------- stats

  @Get("stats")
  async getStats() {
    const rows = await this.prisma.siteStat.findMany({ orderBy: { ord: "asc" } });
    return { stats: rows.map((r) => ({ value: r.value, suffix: r.suffix, label: r.label })) };
  }

  @Put("stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  async saveStats(@Body() body: unknown) {
    const { stats } = parse(StatsSchema, body);
    await this.prisma.$transaction([
      this.prisma.siteStat.deleteMany(),
      ...stats.map((s, i) => this.prisma.siteStat.create({ data: { value: s.value, suffix: s.suffix, label: s.label, ord: i } })),
    ]);
    return { stats: stats.map((s, i) => ({ ...s, id: String(i) })) };
  }

  // ---------------------------------------------------------- subscribers

  @Post("subscribers")
  async subscribe(@Body() body: unknown) {
    const { email } = parse(SubscriberInputSchema, body);
    const normalized = email.toLowerCase();
    const subscriber = await this.prisma.subscriber.upsert({
      where: { email: normalized },
      create: { email: normalized },
      update: {},
    });
    return { subscriber };
  }

  @Get("subscribers")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPERATOR")
  async listSubscribers(@Query() query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const where = {};
    const [rows, total] = await Promise.all([
      this.prisma.subscriber.findMany({ orderBy: [{ subscribedAt: "desc" }, { id: "desc" }], skip: pagination.offset, take: pagination.limit }),
      this.prisma.subscriber.count({ where }),
    ]);
    return {
      subscribers: rows.map((r) => ({ id: r.id, email: r.email, subscribedAt: r.subscribedAt.toISOString() })),
      pagination: paginationMeta(pagination, total),
    };
  }

  // -------------------------------------------------------------- gallery

  @Get("gallery")
  async listGallery(@Query() query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const [rows, total] = await Promise.all([
      this.prisma.galleryItem.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: pagination.offset, take: pagination.limit }),
      this.prisma.galleryItem.count(),
    ]);
    return {
      gallery: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      pagination: paginationMeta(pagination, total),
    };
  }

  @Post("gallery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR", "OPERATOR")
  async addGallery(@Body() body: unknown) {
    const input = parse(GalleryInputSchema, body);
    const item = await this.prisma.galleryItem.create({
      data: { image: input.image, imageHash: createHash("sha256").update(input.image).digest("hex"), caption: input.caption, link: input.link ?? null },
    });
    return { item: { ...item, createdAt: item.createdAt.toISOString() } };
  }

  @Delete("gallery/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async removeGallery(@Param("id") id: string) {
    await this.prisma.galleryItem.delete({ where: { id } });
    return { ok: true };
  }
}