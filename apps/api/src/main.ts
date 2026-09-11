import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import express from "express";
import { randomUUID } from "node:crypto";
import { AppModule } from "./app.module";
import { config } from "./config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());
  (app.getHttpAdapter().getInstance() as any).set("trust proxy", config.trustProxy);
  app.use("/media", express.static(config.mediaDir, {
    dotfiles: "deny",
    index: false,
    fallthrough: true,
    setHeaders: (res) => {
      // Stored media is signature-validated, but never allow a browser to
      // reinterpret a typed response as HTML.
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }));
  app.use((req: any, res: any, next: () => void) => { req.id = req.headers["x-request-id"] || randomUUID(); res.setHeader("x-request-id", req.id); next(); });
  const origins = config.corsOrigins;
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  if (config.nodeEnv !== "production") {
    const config = new DocumentBuilder().setTitle("TPB API").setVersion("1").addBearerAuth().build();
    SwaggerModule.setup("v1/docs", app, SwaggerModule.createDocument(app, config));
  }
  await app.listen(config.port);
}
bootstrap();
