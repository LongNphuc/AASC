import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import type { AuthUser, ProfileView } from '../types/auth.types';

/** Thông tin của người đang đăng nhập. Mọi endpoint cần token. */
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly auth: AuthService) {}

  /** GET /users/me */
  @Get()
  get(@CurrentUser() user: AuthUser): Promise<ProfileView> {
    return this.auth.getProfile(user);
  }

  /** PATCH /users/me { email?, nickname? } */
  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileView> {
    return this.auth.updateProfile(user, dto);
  }
}
