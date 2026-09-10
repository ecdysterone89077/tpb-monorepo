import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { GalleryInputSchema, StatsSchema, SubscriberInputSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth";
import { parse } from "../zod";

@Controller()
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  health() {
    return { ok: true };
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
    const existing = await this.prisma.subscriber.findUnique({ where: { email: normalized } });
    if (existing) return { subscriber: existing };
    const subscriber = await this.prisma.subscriber.create({ data: { email: normalized } });
    return { subscriber };
  }

  @Get("subscribers")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPERATOR")
  async listSubscribers() {
    const rows = await this.prisma.subscriber.findMany({ orderBy: { subscribedAt: "desc" } });
    return {
      subscribers: rows.map((r) => ({ id: r.id, email: r.email, subscribedAt: r.subscribedAt.toISOString() })),
    };
  }

  // -------------------------------------------------------------- gallery

  @Get("gallery")
  async listGallery() {
    const rows = await this.prisma.galleryItem.findMany({ orderBy: { createdAt: "desc" } });
    return { gallery: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  }

  @Post("gallery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR", "OPERATOR")
  async addGallery(@Body() body: unknown) {
    const input = parse(GalleryInputSchema, body);
    const item = await this.prisma.galleryItem.create({
      data: { image: input.image, caption: input.caption, link: input.link ?? null },
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