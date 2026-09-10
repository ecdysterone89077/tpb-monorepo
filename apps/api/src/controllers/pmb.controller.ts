import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { PmbInputSchema, PmbStatusSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth";
import { parse } from "../zod";

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
    const registration = await this.prisma.pmbRegistration.create({
      data: {
        idempotencyKey: key,
        name: input.name,
        email: input.email,
        phone: input.phone,
        school: input.school,
        program: input.program,
        message: input.message,
      },
    });
    return { registration };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPERATOR")
  async list(@Query("all") all?: string) {
    const registrations = await this.prisma.pmbRegistration.findMany({
      where: all === "1" ? {} : { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return { registrations };
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