import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { appConfig, type AppConfig } from '../config/app-config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './controllers/auth.controller';
import { ProfileController } from './controllers/profile.controller';
import { PresenceGateway } from './gateways/presence.gateway';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { PresenceService } from './services/presence.service';

/**
 * Tài khoản: đăng ký, đăng nhập (JWT), cập nhật thông tin, theo dõi ai đang
 * online. Chia sẻ AuthService (xác thực token cho WebSocket) và JwtAuthGuard
 * cho các game.
 */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [appConfig.KEY],
      useFactory: (config: AppConfig) => ({
        secret: config.jwt.secret,
        signOptions: {
          expiresIn: config.jwt
            .expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController, ProfileController],
  providers: [AuthService, PresenceService, PresenceGateway, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
