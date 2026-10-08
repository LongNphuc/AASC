/**
 * Phần dùng chung của client: lưu token, gọi API HTTP, mở kết nối Socket.IO.
 * Token JWT lưu trong localStorage sau khi đăng nhập.
 */
const Api = (() => {
  const TOKEN_KEY = 'game_token';
  const USER_KEY = 'game_user';
  const NOTICE_KEY = 'game_notice';
  /** Mã lỗi khiến client tự đăng xuất: token hỏng, tài khoản đang online nơi khác. */
  const LOGOUT_ERRORS = [20002, 20006];

  function token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function user() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function saveLogin(result) {
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  }

  function saveUser(profile) {
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
  }

  /** Đăng xuất về trang chủ; có `notice` thì trang chủ hiện thông báo đó. */
  function logout(notice) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    if (notice) sessionStorage.setItem(NOTICE_KEY, notice);
    location.href = '/';
  }

  /** Lấy (một lần) thông báo để lại lúc bị đăng xuất. */
  function takeNotice() {
    const notice = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return notice;
  }

  /** Gọi API; lỗi thì ném object { status, errorKbn, message } của server. */
  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (token() && LOGOUT_ERRORS.includes(data.errorKbn)) {
        logout(data.message);
      }
      throw { status: response.status, ...data };
    }
    return data;
  }

  /** Thông báo lỗi dễ đọc (server có thể trả mảng thông báo validate). */
  function errorText(error) {
    const message = error && error.message;
    return Array.isArray(message)
      ? message.join('. ')
      : message || String(error);
  }

  /** Trang game: chưa đăng nhập thì quay về trang chủ. */
  function requireLogin() {
    if (!token()) location.href = '/';
  }

  /**
   * Kết nối namespace Socket.IO kèm token. Token hết hạn (20002), hoặc tài
   * khoản đang online ở nơi khác (20006), thì server từ chối kết nối
   * (connect_error) → đăng xuất, trang chủ hiện lý do.
   */
  function connect(namespace) {
    const socket = io(namespace, { auth: { token: token() } });
    socket.on('connect_error', (error) => {
      if (error.data && LOGOUT_ERRORS.includes(error.data.errorKbn)) {
        logout(error.message);
      }
    });
    return socket;
  }

  /** Gửi sự kiện, chờ phản hồi { ok, data } hoặc { ok: false, errorKbn, message }. */
  function emit(socket, event, data) {
    return socket
      .timeout(5000)
      .emitWithAck(event, data)
      .catch(() => ({
        ok: false,
        message: 'Máy chủ không phản hồi',
      }));
  }

  return {
    token,
    user,
    saveLogin,
    saveUser,
    logout,
    takeNotice,
    request,
    errorText,
    requireLogin,
    connect,
    emit,
  };
})();

/** Hiển thị thông báo trong phần tử .message. */
function showMessage(element, text, type) {
  element.textContent = text || '';
  element.className = `message ${type || ''}`;
}
