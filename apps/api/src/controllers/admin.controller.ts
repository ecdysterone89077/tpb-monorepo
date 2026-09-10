import { Body, Controller, Delete, Get, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { hash } from "@node-rs/argon2";
import { diskStorage } from "multer";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { UserInputSchema, UserUpdateSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, type RequestUser } from "../auth";
import { parse } from "../zod";

type AuthRequest = Request & { user?: RequestUser };

const MEDIA_DIR = process.env.MEDIA_DIR || "uploads";
const MEDIA_MAX_MB = Number(process.env.MEDIA_MAX_MB || 10);

@Controller()
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- users

  @Get("users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async listUsers() {
    const rows = await this.prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return {
      users: rows.map((r) => ({
        id: r.id, email: r.email, name: r.name, role: r.role, isActive: r.isActive,
        createdAt: r.createdAt.toISOString(), lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
      })),
    };
  }

  @Post("users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async createUser(@Body() body: unknown) {
    const input = parse(UserInputSchema, body);
    const passwordHash = await hash(input.password);
    const user = await this.prisma.user.create({ data: { name: input.name, email: input.email.toLowerCase(), passwordHash, role: input.role } });
    return { user: { ...user, passwordHash: undefined } };
  }

  @Put("users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async updateUser(@Param("id") id: string, @Body() body: unknown) {
    const input = parse(UserUpdateSchema, body);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.role !== undefined) data.role = input.role;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.password) data.passwordHash = await hash(input.password);
    const user = await this.prisma.user.update({ where: { id }, data });
    return { user: { ...user, passwordHash: undefined } };
  }

  @Delete("users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async deleteUser(@Param("id") id: string, @Req() req: AuthRequest) {
    if (req.user?.id === id) throw new Error("Tidak dapat menghapus akun sendiri.");
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- audit

  @Get("audit")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async listAudit() {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { email: true } } } });
    return {
      audit: rows.map((r) => ({
        id: r.id, userId: r.userId, action: r.action, entity: r.entity, entityId: r.entityId,
        metadata: r.metadata, ip: r.ip, createdAt: r.createdAt.toISOString(), user: r.user ? { email: r.user.email } : null,
      })),
    };
  }

  // ------------------------------------------------------------ dashboard

  @Get("dashboard/summary")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async dashboardSummary() {
    const [posts, newPmb, subscribers, media, audit] = await Promise.all([
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.pmbRegistration.count({ where: { deletedAt: null, status: "baru" } }),
      this.prisma.subscriber.count(),
      this.prisma.mediaAsset.count(),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { email: true } } } }),
    ]);
    return {
      posts, newPmb, subscribers, media,
      audit: audit.map((r) => ({
        id: r.id, userId: r.userId, action: r.action, entity: r.entity, entityId: r.entityId,
        metadata: r.metadata, ip: r.ip, createdAt: r.createdAt.toISOString(), user: r.user ? { email: r.user.email } : null,
      })),
    };
  }

  // ---------------------------------------------------------------- media

  @Post("media/upload")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR", "OPERATOR")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: MEDIA_MAX_MB * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(file.mimetype);
        cb(null, ok);
      },
    }),
  )
  async uploadMedia(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new Error("Berkas tidak diterima atau jenis berkas tidak diizinkan.");
    const asset = await this.prisma.mediaAsset.create({
      data: { url: `/media/${file.filename}`, filename: file.originalname, mimeType: file.mimetype, size: file.size, alt: null },
    });
    return { item: { ...asset, createdAt: asset.createdAt.toISOString() } };
  }

  @Get("media")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR", "OPERATOR")
  async listMedia() {
    const rows = await this.prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" } });
    return { media: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  }
}