/**
 * Trang chủ: đăng nhập, đăng ký; sau khi đăng nhập là sảnh chờ và form cập
 * nhật email, nickname (PATCH /users/me, chỉ người đã đăng nhập).
 */
(() => {
  const TEXT = {
    REGISTERED: 'Đăng ký thành công, đang đăng nhập...',
    SAVED: 'Đã lưu thông tin',
  };
  const $ = (id) => document.getElementById(id);
  let presence = null; // kết nối /presence: đang ở sảnh cũng tính là online

  function showAuth() {
    $('auth').classList.remove('hidden');
    $('lobby').classList.add('hidden');
    $('nav').classList.add('hidden');
    // Lý do bị đăng xuất (ví dụ tài khoản đang online ở nơi khác).
    const notice = Api.takeNotice();
    if (notice) showMessage($('auth-message'), notice, 'error');
  }

  async function showLobby() {
    $('auth').classList.add('hidden');
    $('lobby').classList.remove('hidden');
    $('nav').classList.remove('hidden');
    // Đọc lại từ server để có thông tin mới nhất (và kiểm tra token còn hạn).
    const profile = await Api.request('GET', '/users/me');
    Api.saveUser(profile);
    if (!presence) presence = Api.connect('/presence');
    $('hello-name').textContent = profile.nickname;
    $('profile-username').value = profile.username;
    $('profile-nickname').value = profile.nickname;
    $('profile-email').value = profile.email || '';
  }

  function switchTab(showLogin) {
    $('tab-login').classList.toggle('active', showLogin);
    $('tab-register').classList.toggle('active', !showLogin);
    $('login-form').classList.toggle('hidden', !showLogin);
    $('register-form').classList.toggle('hidden', showLogin);
    showMessage($('auth-message'), '');
  }

  async function login(username, password) {
    const result = await Api.request('POST', '/auth/login', {
      username,
      password,
    });
    Api.saveLogin(result);
    await showLobby();
  }

  $('tab-login').addEventListener('click', () => switchTab(true));
  $('tab-register').addEventListener('click', () => switchTab(false));
  $('logout').addEventListener('click', (e) => {
    e.preventDefault();
    Api.logout();
  });

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await login($('login-username').value, $('login-password').value);
    } catch (error) {
      showMessage($('auth-message'), Api.errorText(error), 'error');
    }
  });

  $('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      username: $('reg-username').value,
      password: $('reg-password').value,
    };
    if ($('reg-nickname').value.trim()) body.nickname = $('reg-nickname').value;
    if ($('reg-email').value.trim()) body.email = $('reg-email').value;
    try {
      await Api.request('POST', '/auth/register', body);
      showMessage($('auth-message'), TEXT.REGISTERED, 'ok');
      await login(body.username, body.password);
    } catch (error) {
      showMessage($('auth-message'), Api.errorText(error), 'error');
    }
  });

  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { nickname: $('profile-nickname').value };
    if ($('profile-email').value.trim()) body.email = $('profile-email').value;
    try {
      const profile = await Api.request('PATCH', '/users/me', body);
      Api.saveUser(profile);
      $('hello-name').textContent = profile.nickname;
      showMessage($('profile-message'), TEXT.SAVED, 'ok');
    } catch (error) {
      showMessage($('profile-message'), Api.errorText(error), 'error');
    }
  });

  if (Api.token()) {
    showLobby().catch(showAuth);
  } else {
    showAuth();
  }
})();
