import { Body, Controller, Delete, Get, Param, Post as PostMethod, Put, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { PostInputSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";

type CookieRequest = Request & { user?: RequestUser };

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 190) || "post";

@Controller("posts")
export class PostsController {
  constructor(private readonly prisma: PrismaService) {}

  // Public: published only. ?all=1 with auth: everything (admin).
  @Get()
  async list(@Query("all") all: string, @Req() req: CookieRequest) {
    if (all === "1") {
      const user = req.user;
      if (!user) throw new UnauthorizedException("Token akses diperlukan.");
      const rows = await this.prisma.post.findMany({ where: { deletedAt: null }, orderBy: { date: "desc" } });
      return { posts: rows };
    }
    const rows = await this.prisma.post.findMany({ where: { deletedAt: null, status: "published" }, orderBy: { date: "desc" } });
    return { posts: rows };
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const row = await this.prisma.post.findFirst({ where: { OR: [{ id }, { slug: id }], deletedAt: null } });
    return { post: row ?? null };
  }

  @PostMethod()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  async create(@Body() body: unknown, @Req() req: CookieRequest) {
    const input = parse(PostInputSchema, body);
    let slug = slugify(input.title);
    const clash = await this.prisma.post.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now()}`;
    const row = await this.prisma.post.create({
      data: {
        slug,
        title: input.title,
        category: input.category,
        excerpt: input.excerpt ?? "",
        content: input.content ?? null,
        image: input.image ?? null,
        readTime: input.readTime ?? "",
        status: input.status ?? "draft",
        date: input.date ? new Date(input.date) : new Date(),
        authorId: req.user?.id ?? null,
      },
    });
    return { post: row };
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const input = parse(PostInputSchema, body);
    const row = await this.prisma.post.update({
      where: { id },
      data: {
        title: input.title,
        category: input.category,
        excerpt: input.excerpt ?? "",
        content: input.content ?? null,
        image: input.image ?? null,
        readTime: input.readTime ?? "",
        status: input.status ?? "draft",
        ...(input.date ? { date: new Date(input.date) } : {}),
      },
    });
    return { post: row };
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async remove(@Param("id") id: string) {
    await this.prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
