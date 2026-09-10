import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards, ConflictException } from "@nestjs/common";
import { PmbInputSchema, PmbStatusSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth";
import { parse } from "../zod";
import { parsePagination, paginationMeta } from "../pagination";

@Controller("pmb")
export class PmbController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const input = parse(PmbInputSchema, body);
    const key = input.idempotencyKey ?? crypto.randomUUID();
    const existing = await this.prisma.pmbRegistration.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { registration: existing };
    try {
      const registration = await this.prisma.pmbRegistration.create({
        data: { idempotencyKey: key, name: input.name, email: input.email, phone: input.phone, school: input.school, program: input.program, message: input.message },
      });
      return { registration };
    } catch (error: any) {
      // A concurrent request may win the unique-key race; return its result.
      if (error?.code === "P2002") {
        const concurrent = await this.prisma.pmbRegistration.findUnique({ where: { idempotencyKey: key } });
        if (concurrent) return { registration: concurrent };
      }
      throw new ConflictException("Gagal menyimpan pendaftaran PMB.");
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPERATOR")
  async list(@Query("all") all?: string, @Query() query: Record<string, unknown> = {}) {
    const pagination = parsePagination(query);
    const where = all === "1" ? {} : { deletedAt: null };
    const [registrations, total] = await Promise.all([
      this.prisma.pmbRegistration.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: pagination.offset, take: pagination.limit }),
      this.prisma.pmbRegistration.count({ where }),
    ]);
    return { registrations, pagination: paginationMeta(pagination, total) };
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPERATOR")
  async status(@Param("id") id: string, @Body() body: unknown) {
    const { status } = parse(PmbStatusSchema, body);
    const registration = await this.prisma.pmbRegistration.update({ where: { id }, data: { status } });
    return { registration };
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async remove(@Param("id") id: string) {
    await this.prisma.pmbRegistration.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
