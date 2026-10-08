import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import {
  ERROR,
  LOG,
  VALIDATION,
} from '../../common/constants/messages.constant';
import { GameException } from '../../common/errors/game.exception';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { appConfig, type AppConfig } from '../../config/app-config';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import {
  AuthUser,
  JwtPayload,
  LoginResult,
  ProfileView,
} from '../types/auth.types';
import { PresenceService } from './presence.service';

/**
 * Tài khoản: đăng ký (băm mật khẩu bằng bcrypt), đăng nhập (cấp JWT), xác
 * thực token cho HTTP và WebSocket, cập nhật email/nickname. Một tài khoản chỉ
 * được online ở một nơi (xem PresenceService).
 */
@Injectable()
export class AuthService {
  private readonly logger = new ServiceLogger(
    LogService.AUTH,
    AuthService.name,
  );

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto): Promise<ProfileView> {
    if (await this.users.findByUsername(dto.username)) {
      throw new GameException(
        ErrorKbn.USERNAME_TAKEN,
        ERROR.AUTH.USERNAME_TAKEN(dto.username),
        HttpStatus.CONFLICT,
      );
    }
    // bcrypt tự sinh salt ngẫu nhiên và lưu luôn trong chuỗi băm.
    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.bcryptRounds,
    );
    const user = await this.users.create({
      username: dto.username,
      passwordHash,
      nickname: dto.nickname ?? dto.username,
      email: dto.email ?? null,
    });
    this.logger.log(LOG.AUTH.REGISTERED(user.username));
    return toProfile(user);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findByUsername(dto.username);
    // Sai tên đăng nhập hay sai mật khẩu đều báo cùng một câu, để không lộ
    // tên đăng nhập nào đang tồn tại.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new GameException(
        ErrorKbn.INVALID_CREDENTIALS,
        ERROR.AUTH.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
      );
    }
    // Kiểm tra sau mật khẩu, để người không biết mật khẩu không dò được ai
    // đang online.
    if (this.presence.isOnline(user.uuid)) {
      throw accountInUse();
    }
    const payload: JwtPayload = {
      sub: user.uuid,
      username: user.username,
      sid: randomUUID(),
    };
    this.logger.log(LOG.AUTH.LOGGED_IN(user.username));
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.jwt.expiresIn,
      user: toProfile(user),
    };
  }

  /**
   * Xác thực token (dùng cho cả HTTP guard và kết nối WebSocket). Đọc lại
   * người dùng từ DB để có nickname mới nhất và chặn tài khoản đã bị xóa.
   * Tài khoản đang online ở phiên khác thì token này bị từ chối.
   */
  async verifyToken(token: string | undefined): Promise<AuthUser> {
    if (!token) {
      throw unauthorized(ERROR.AUTH.TOKEN_MISSING);
    }
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw unauthorized(ERROR.AUTH.TOKEN_INVALID);
    }
    if (!payload.sid) {
      throw unauthorized(ERROR.AUTH.TOKEN_INVALID);
    }
    const user = await this.users.findByUuid(payload.sub);
    if (!user) {
      throw unauthorized(ERROR.AUTH.USER_NOT_FOUND);
    }
    if (this.presence.isOnlineElsewhere(user.uuid, payload.sid)) {
      throw accountInUse();
    }
    return {
      uuid: user.uuid,
      username: user.username,
      nickname: user.nickname,
      sessionId: payload.sid,
    };
  }

  /**
   * Ghi nhận một kết nối WebSocket đã xác thực là online. Ném ACCOUNT_IN_USE
   * nếu tài khoản vừa online ở phiên khác (hai nơi kết nối cùng lúc).
   */
  markOnline(user: AuthUser, socketId: string): void {
    if (!this.presence.connect(user.uuid, user.sessionId, socketId)) {
      throw accountInUse();
    }
  }

  markOffline(user: AuthUser, socketId: string): void {
    this.presence.disconnect(user.uuid, socketId);
  }

  async getProfile(authUser: AuthUser): Promise<ProfileView> {
    return toProfile(await this.requireUser(authUser.uuid));
  }

  async updateProfile(
    authUser: AuthUser,
    dto: UpdateProfileDto,
  ): Promise<ProfileView> {
    if (dto.email === undefined && dto.nickname === undefined) {
      throw new GameException(
        ErrorKbn.VALIDATION,
        VALIDATION.NOTHING_TO_UPDATE,
      );
    }
    const user = await this.requireUser(authUser.uuid);
    const updated = await this.users.updateProfile(user, dto);
    this.logger.log(LOG.AUTH.PROFILE_UPDATED(updated.username));
    return toProfile(updated);
  }

  private async requireUser(uuid: string): Promise<User> {
    const user = await this.users.findByUuid(uuid);
    if (!user) {
      throw unauthorized(ERROR.AUTH.USER_NOT_FOUND);
    }
    return user;
  }
}

function unauthorized(message: string): GameException {
  return new GameException(
    ErrorKbn.UNAUTHORIZED,
    message,
    HttpStatus.UNAUTHORIZED,
  );
}

function accountInUse(): GameException {
  return new GameException(
    ErrorKbn.ACCOUNT_IN_USE,
    ERROR.AUTH.ACCOUNT_IN_USE,
    HttpStatus.CONFLICT,
  );
}

function toProfile(user: User): ProfileView {
  return {
    uuid: user.uuid,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    createdAt: user.createdAt,
  };
}
