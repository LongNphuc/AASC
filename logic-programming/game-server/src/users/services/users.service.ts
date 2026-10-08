import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

export interface NewUser {
  username: string;
  passwordHash: string;
  nickname: string;
  email: string | null;
}

/** Đọc/ghi bảng users. Không chứa logic mật khẩu hay token (xem AuthService). */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  create(data: NewUser): Promise<User> {
    return this.users.save(this.users.create(data));
  }

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOneBy({ username });
  }

  findByUuid(uuid: string): Promise<User | null> {
    return this.users.findOneBy({ uuid });
  }

  /** Cập nhật email, nickname; trường nào undefined thì giữ nguyên. */
  async updateProfile(
    user: User,
    changes: { email?: string; nickname?: string },
  ): Promise<User> {
    if (changes.email !== undefined) user.email = changes.email;
    if (changes.nickname !== undefined) user.nickname = changes.nickname;
    return this.users.save(user);
  }
}
