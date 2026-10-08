/**
 * Client cờ caro: vẽ bàn 15x15 bằng HTML5 Canvas, ghép cặp và đồng bộ lượt
 * đi qua WebSocket (namespace /caro). Mọi nước đi do server kiểm tra; client
 * chỉ vẽ khi nhận sự kiện caro:moved từ server.
 */
(() => {
  Api.requireLogin();

  const TEXT = {
    IDLE: 'Chưa vào trận',
    WAITING: 'Đang chờ đối thủ...',
    YOUR_TURN: 'Lượt của bạn',
    THEIR_TURN: 'Lượt đối thủ',
    YOU_ARE: (you, opponent) => `Bạn cầm ${you}, đối thủ: ${opponent}`,
    WIN: 'Bạn thắng!',
    LOSE: 'Bạn thua',
    DRAW: 'Hòa',
    OPPONENT_LEFT: 'Đối thủ đã rời trận, bạn thắng!',
    YOU_LEFT: 'Bạn đã rời trận (xử thua)',
    OUTCOME: { WIN: 'Thắng', LOSE: 'Thua', DRAW: 'Hòa', PLAYING: 'Đang chơi' },
  };
  const SIZE = 15;
  const CELL = 36;
  const MARK_COLORS = { X: '#c0392b', O: '#2563eb' };

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const socket = Api.connect('/caro');

  let board = emptyBoard();
  let match = null; // { matchUuid, you, opponent, turn }
  let lastMove = null;
  let winLine = null;

  function emptyBoard() {
    return Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
  }

  // ---------- Vẽ ----------

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fdfaf3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#cfc6b4';
    ctx.lineWidth = 1;
    for (let i = 0; i <= SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, SIZE * CELL);
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(SIZE * CELL, i * CELL + 0.5);
      ctx.stroke();
    }
    const highlight = (cells, color) =>
      cells.forEach(({ row, col }) => {
        ctx.fillStyle = color;
        ctx.fillRect(col * CELL + 1, row * CELL + 1, CELL - 1, CELL - 1);
      });
    if (lastMove) highlight([lastMove], '#fff1b8');
    if (winLine) highlight(winLine, '#c6f6d5');

    board.forEach((line, row) =>
      line.forEach((symbol, col) => {
        if (!symbol) return;
        const x = col * CELL + CELL / 2;
        const y = row * CELL + CELL / 2;
        const r = CELL * 0.3;
        ctx.strokeStyle = MARK_COLORS[symbol];
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (symbol === 'X') {
          ctx.moveTo(x - r, y - r);
          ctx.lineTo(x + r, y + r);
          ctx.moveTo(x + r, y - r);
          ctx.lineTo(x - r, y + r);
        } else {
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.stroke();
      }),
    );
  }

  // ---------- Trạng thái giao diện ----------

  function setButtons(state) {
    $('find').classList.toggle('hidden', state !== 'idle');
    $('cancel').classList.toggle('hidden', state !== 'waiting');
    $('leave').classList.toggle('hidden', state !== 'playing');
  }

  function showTurn() {
    $('status').textContent =
      match.turn === match.you ? TEXT.YOUR_TURN : TEXT.THEIR_TURN;
    $('detail').textContent = TEXT.YOU_ARE(match.you, match.opponent.nickname);
  }

  async function loadHistory() {
    try {
      const rows = await Api.request('GET', '/caro/matches');
      $('history').innerHTML = rows
        .map(
          (m) => `<tr>
            <td>${new Date(m.startedAt).toLocaleString('vi-VN')}</td>
            <td>${m.you}</td>
            <td>${escapeHtml(m.opponentNickname)}</td>
            <td>${TEXT.OUTCOME[m.outcome]}${m.result === 'ABANDONED' ? ' (bỏ cuộc)' : ''}</td>
            <td>${m.moveCount}</td>
          </tr>`,
        )
        .join('');
    } catch (error) {
      showMessage($('message'), Api.errorText(error), 'error');
    }
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  // ---------- Sự kiện từ server ----------

  socket.on('caro:matched', (info) => {
    match = info;
    board = emptyBoard();
    lastMove = null;
    winLine = null;
    setButtons('playing');
    showMessage($('message'), '');
    showTurn();
    render();
  });

  socket.on('caro:moved', (move) => {
    if (!match || move.matchUuid !== match.matchUuid) return;
    board[move.row][move.col] = move.symbol;
    lastMove = move;
    match.turn = move.nextTurn;
    showTurn();
    render();
  });

  socket.on('caro:over', (result) => {
    if (!match || result.matchUuid !== match.matchUuid) return;
    winLine = result.winLine;
    let text = TEXT.DRAW;
    if (result.result === 'ABANDONED') {
      text =
        result.winSymbol === match.you ? TEXT.OPPONENT_LEFT : TEXT.YOU_LEFT;
    } else if (result.winSymbol) {
      text = result.winSymbol === match.you ? TEXT.WIN : TEXT.LOSE;
    }
    $('status').textContent = text;
    match = null;
    closeLeaveDialog(); // trận đã kết thúc thì không cần hỏi rời trận nữa
    setButtons('idle');
    render();
    loadHistory();
  });

  // ---------- Hỏi lại trước khi rời trận ----------

  let afterLeave = null; // việc làm tiếp khi người chơi chọn "Có, rời trận"

  function askLeave(then) {
    afterLeave = then;
    $('leave-dialog').classList.remove('hidden');
    $('leave-no').focus();
  }

  function closeLeaveDialog() {
    afterLeave = null;
    $('leave-dialog').classList.add('hidden');
  }

  $('leave-yes').addEventListener('click', async () => {
    const then = afterLeave;
    closeLeaveDialog();
    // Báo server trước (xử thua, đối thủ thắng) rồi mới rời trang. Lỡ lệnh này
    // lỗi thì rời trang cũng ngắt kết nối, server vẫn xử thua.
    await Api.emit(socket, 'caro:leave');
    if (then) then();
  });
  $('leave-no').addEventListener('click', closeLeaveDialog);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLeaveDialog();
  });

  /**
   * Liên kết sang trang khác (Sảnh, Line 98, Đăng xuất): đang trong trận thì
   * hỏi lại. Tải lại trang, đóng trình duyệt thì không hỏi: mất kết nối là
   * server xử thua ngay.
   */
  document.querySelectorAll('header nav a').forEach((link) =>
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const go =
        link.id === 'logout'
          ? () => Api.logout()
          : () => (location.href = link.href);
      if (match) askLeave(go);
      else go();
    }),
  );

  // ---------- Thao tác ----------

  canvas.addEventListener('click', async (e) => {
    if (!match || match.turn !== match.you) return;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor(
      ((e.clientX - rect.left) * (canvas.width / rect.width)) / CELL,
    );
    const row = Math.floor(
      ((e.clientY - rect.top) * (canvas.height / rect.height)) / CELL,
    );
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE || board[row][col])
      return;
    const res = await Api.emit(socket, 'caro:move', {
      matchUuid: match.matchUuid,
      row,
      col,
    });
    if (!res.ok) showMessage($('message'), res.message, 'error');
  });

  $('find').addEventListener('click', async () => {
    const res = await Api.emit(socket, 'caro:find');
    if (!res.ok) return showMessage($('message'), res.message, 'error');
    if (res.data.status === 'waiting') {
      $('status').textContent = TEXT.WAITING;
      $('detail').textContent = '';
      setButtons('waiting');
    }
    // status 'matched': giao diện cập nhật khi nhận caro:matched.
  });

  $('cancel').addEventListener('click', async () => {
    await Api.emit(socket, 'caro:cancel');
    $('status').textContent = TEXT.IDLE;
    setButtons('idle');
  });

  $('leave').addEventListener('click', () => Api.emit(socket, 'caro:leave'));

  setButtons('idle');
  render();
  loadHistory();
})();
