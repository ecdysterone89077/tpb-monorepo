import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { PmbController } from "./controllers/pmb.controller";
import { PostsController } from "./controllers/posts.controller";
import { parse } from "./zod";
import { PmbInputSchema, PostInputSchema } from "@tpb/contracts";

describe("controller behavior with mocked Prisma", () => {
  it("PMB mengembalikan registration yang sama untuk idempotency key yang sudah ada", async () => {
    const existing = { id: "r1", idempotencyKey: "550e8400-e29b-41d4-a716-446655440000" };
    const prisma = {
      pmbRegistration: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    };
    const controller = new PmbController(prisma as any);
    const result = await controller.create({
      name: "A",
      email: "a@example.com",
      phone: "081234567890",
      idempotencyKey: existing.idempotencyKey,
    });
    expect(result).toEqual({ registration: existing });
    expect(prisma.pmbRegistration.create).not.toHaveBeenCalled();
  });

  it("PMB membuat registration baru bila key belum ada", async () => {
    const created = { id: "r2" };
    const prisma = {
      pmbRegistration: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const controller = new PmbController(prisma as any);
    const result = await controller.create({
      name: "A",
      email: "a@example.com",
      phone: "081234567890",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result).toEqual({ registration: created });
    expect(prisma.pmbRegistration.create).toHaveBeenCalledTimes(1);
  });

  it("posts list publik hanya meminta post published yang belum dihapus", async () => {
    const prisma = { post: { findMany: jest.fn().mockResolvedValue([]) } };
    const jwt = { verify: jest.fn().mockReturnValue({ id: "u1", role: "EDITOR" }) };
    const controller = new PostsController(prisma as any, jwt as any);
    await controller.list(undefined as any, { user: undefined } as any);
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "published" },
      orderBy: { date: "desc" },
    });
  });

  it("posts all tanpa user ditolak", async () => {
    const controller = new PostsController({ post: { findMany: jest.fn() } } as any, { verify: jest.fn() } as any);
    await expect(controller.list("1", { user: undefined } as any)).rejects.toThrow(UnauthorizedException);
  });

  it("schema post menolak tanggal invalid dan parse memberi BadRequestException", () => {
    expect(() => parse(PostInputSchema, { title: "x", category: "Umum", date: "not-a-date" })).toThrow(BadRequestException);
  });

  it("schema PMB menolak email invalid dan phone terlalu pendek", () => {
    expect(() => parse(PmbInputSchema, { name: "A", email: "invalid", phone: "123" })).toThrow(BadRequestException);
  });
});
