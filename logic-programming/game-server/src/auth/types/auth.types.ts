/** Nội dung ký trong JWT. */
export interface JwtPayload {
  /** uuid của người dùng. */
  sub: string;
  username: string;
  /** Mã phiên: mỗi lần đăng nhập một mã mới (xem PresenceService). */
  sid: string;
}

/** Người dùng đã xác thực, gắn vào request HTTP hoặc socket. */
export interface AuthUser {
  uuid: string;
  username: string;
  nickname: string;
  /** Phiên đăng nhập của token (JwtPayload.sid). */
  sessionId: string;
}

/** Thông tin tài khoản trả về client (không có mật khẩu). */
export interface ProfileView {
  uuid: string;
  username: string;
  nickname: string;
  email: string | null;
  createdAt: Date;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: ProfileView;
}
