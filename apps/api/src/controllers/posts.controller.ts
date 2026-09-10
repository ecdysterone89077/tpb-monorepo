import { Body, Controller, Delete, Get, Param, Post as PostMethod, Put, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { PostInputSchema, type Role } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser, safeUser } from "../auth";
import { parse } from "../zod";
import { parsePagination, paginationMeta } from "../pagination";

type CookieRequest = Request & { user?: RequestUser };

// Roles allowed to read non-published material.
const EDITORIAL: Role[] = ["ADMIN", "EDITOR"];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 220) || "post";

@Controller("posts")
export class PostsController {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  // Optional authentication: returns the request user when a valid token is present.
  private async optionalUser(req: CookieRequest): Promise<RequestUser | null> {
    const raw = req.headers?.authorization?.replace(/^Bearer\s+/i, "");
    if (!raw) return null;
    try {
      const payload = this.jwt.verify<{ id?: string }>(raw);
      if (!payload.id) return null;
      const user = await this.prisma.user.findUnique({ where: { id: payload.id } });
      return user?.isActive ? safeUser(user) : null;
    } catch {
      return null;
    }
  }

  // Public: published only. ?all=1 (ADMIN/EDITOR): everything, including drafts.
  @Get()
  async list(@Query("all") all: string, @Query() query: Record<string, unknown>, @Req() req: CookieRequest) {
    const pagination = parsePagination(query);
    const where = all === "1" ? { deletedAt: null } : { deletedAt: null, status: "published" as const };
    if (all === "1") {
      const user = await this.optionalUser(req);
      if (!user) throw new UnauthorizedException("Token akses diperlukan.");
      if (!EDITORIAL.includes(user.role)) throw new UnauthorizedException("Role tidak memiliki akses.");
    }
    const [rows, total] = await Promise.all([
      this.prisma.post.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], skip: pagination.offset, take: pagination.limit }),
      this.prisma.post.count({ where }),
    ]);
    return { posts: rows, pagination: paginationMeta(pagination, total) };
  }

  // Public: published only. Drafts require an ADMIN/EDITOR token.
  @Get(":id")
  async get(@Param("id") id: string, @Req() req: CookieRequest) {
    const where = { OR: [{ id }, { slug: id }], deletedAt: null };
    const row = await this.prisma.post.findFirst({ where });
    if (!row) return { post: null };
    if (row.status !== "published") {
      const user = await this.optionalUser(req);
      if (!user || !EDITORIAL.includes(user.role)) return { post: null };
    }
    return { post: row };
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
