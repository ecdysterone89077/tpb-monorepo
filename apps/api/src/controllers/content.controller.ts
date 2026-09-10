import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ContentSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";

type CookieRequest = Request & { user?: RequestUser };

@Controller("content")
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  // Public: returns {content} where content may be null (belum dikonfigurasi).
  @Get()
  async get() {
    const row = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    return { content: row?.data ?? null };
  }

  // Only ADMIN may replace the public site content (navigation, branding, copy).
  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const { content } = parse(ContentSchema, body);
    const saved = await this.prisma.siteContent.upsert({
      where: { key: "main" },
      create: { key: "main", data: content as any, updatedBy: req.user?.id ?? null },
      update: { data: content as any, updatedBy: req.user?.id ?? null },
    });
    return { content: saved.data, updatedAt: saved.updatedAt };
  }
}
