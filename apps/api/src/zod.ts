import { BadRequestException } from "@nestjs/common";
import type { ZodSchema } from "zod";

export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException({
      message: "Data tidak valid.",
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}
