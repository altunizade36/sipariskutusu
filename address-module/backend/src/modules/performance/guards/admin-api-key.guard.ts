import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(AdminApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const adminKey = process.env.ADMIN_API_KEY?.trim();

    if (!adminKey) {
      this.logger.error('ADMIN_API_KEY is not configured; blocking all admin endpoint access.');
      throw new UnauthorizedException('Admin endpoint access is not configured.');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-admin-key'];

    if (typeof provided !== 'string' || provided.trim() !== adminKey) {
      throw new UnauthorizedException('Invalid or missing admin API key.');
    }

    return true;
  }
}
