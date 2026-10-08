import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthService } from '../services/auth.service';
import { LoginResult, ProfileView } from '../types/auth.types';

/** Đăng ký, đăng nhập (không cần token). */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /auth/register → 201, thông tin tài khoản mới. */
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<ProfileView> {
    return this.auth.register(dto);
  }

  /** POST /auth/login → 200, { accessToken, user }. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto);
  }
}
