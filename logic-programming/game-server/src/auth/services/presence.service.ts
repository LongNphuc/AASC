import { Injectable } from '@nestjs/common';

/**
 * Ai đang online. Mỗi trang của client (sảnh, Line 98, cờ caro) giữ một kết
 * nối WebSocket; người dùng còn ít nhất một kết nối là đang online.
 *
 * Mỗi lần đăng nhập là một phiên (mã phiên `sid` nằm trong JWT). Các tab trong
 * cùng trình duyệt dùng chung token nên chung phiên, mở song song được.
 * Quy tắc: một tài khoản chỉ online ở một phiên.
 * - Đang online thì không cho đăng nhập ở nơi khác (AuthService.login).
 * - Token của phiên khác không được kết nối hay gọi API (AuthService.verifyToken).
 *
 * Giữ trong bộ nhớ nên chỉ đúng khi chạy một tiến trình (giống hàng chờ caro).
 */
@Injectable()
export class PresenceService {
  /** userUuid → (socketId → sessionId). */
  private readonly sockets = new Map<string, Map<string, string>>();

  isOnline(userUuid: string): boolean {
    return this.sockets.has(userUuid);
  }

  /** Tài khoản đang online ở một phiên khác `sessionId`. */
  isOnlineElsewhere(userUuid: string, sessionId: string): boolean {
    const mine = this.sockets.get(userUuid);
    return !!mine && [...mine.values()].some((sid) => sid !== sessionId);
  }

  /**
   * Ghi nhận một kết nối của phiên `sessionId`. Trả về false (không ghi nhận)
   * nếu tài khoản đang online ở phiên khác.
   */
  connect(userUuid: string, sessionId: string, socketId: string): boolean {
    if (this.isOnlineElsewhere(userUuid, sessionId)) {
      return false;
    }
    const mine = this.sockets.get(userUuid) ?? new Map<string, string>();
    mine.set(socketId, sessionId);
    this.sockets.set(userUuid, mine);
    return true;
  }

  disconnect(userUuid: string, socketId: string): void {
    const mine = this.sockets.get(userUuid);
    if (!mine) {
      return;
    }
    mine.delete(socketId);
    if (mine.size === 0) {
      this.sockets.delete(userUuid);
    }
  }
}
