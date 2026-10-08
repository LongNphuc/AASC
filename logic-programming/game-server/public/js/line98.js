/**
 * Client Line 98: vẽ bàn bằng HTML5 Canvas, gửi nước đi qua WebSocket
 * (namespace /line98). Server giữ luật và trạng thái; client chỉ vẽ và tạo
 * hiệu ứng: bóng được chọn phóng to nhấp nháy, bóng chạy theo đường đi, bóng
 * bị xóa thu nhỏ dần, bóng mới sinh lớn dần.
 */
(() => {
  Api.requireLogin();

  const TEXT = {
    NO_HINT: 'Không còn nước đi',
    HINT: 'Gợi ý: di chuyển bóng đang nhấp nháy tới ô có viền',
    GAME_OVER: (score) =>
      `Hết nước đi! Điểm cuối cùng: ${score}. Bấm "Ván mới" để chơi lại.`,
    REMOVED: (count) => `+${count} điểm`,
  };
  const SIZE = 9;
  const CELL = 50;
  const RADIUS = 18;
  const COLORS = [null, '#e74c3c', '#27ae60', '#2980b9', '#f1c40f', '#8e44ad'];
  const STEP_MS = 45; // thời gian bóng đi qua một ô
  const FADE_MS = 300; // thời gian bóng bị xóa thu nhỏ, bóng mới lớn dần

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const message = document.getElementById('message');
  const socket = Api.connect('/line98');

  let game = null; // { board, nextColors, score, status }
  let selected = null; // { row, col }
  let hint = null; // { from, to } đang hiển thị
  let animation = null; // hiệu ứng đang chạy, trong lúc này không nhận click
  let pending = false; // đang chờ server trả lời, trong lúc này không nhận click

  /** Đang đi bóng (chờ server hoặc đang chạy hiệu ứng): bỏ qua thao tác mới. */
  const busy = () => pending || animation !== null;

  // ---------- Vẽ ----------

  function drawBall(row, col, color, scale) {
    const x = col * CELL + CELL / 2;
    const y = row * CELL + CELL / 2;
    const r = RADIUS * scale;
    if (r <= 0) return;
    const gradient = ctx.createRadialGradient(
      x - r / 3,
      y - r / 3,
      r / 6,
      x,
      y,
      r,
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.35, COLORS[color]);
    gradient.addColorStop(1, COLORS[color]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2);
      }
    }
    if (hint) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        hint.to.col * CELL + 3,
        hint.to.row * CELL + 3,
        CELL - 6,
        CELL - 6,
      );
    }
  }

  /** Vẽ một khung hình: bàn hiện tại, hoặc khung của hiệu ứng đang chạy. */
  function render(now) {
    // Hẹn khung tiếp theo trước khi vẽ, để một khung lỗi không làm dừng cả vòng vẽ.
    requestAnimationFrame(render);
    drawGrid();
    if (animation) {
      animation.draw(now);
    } else if (game) {
      const pulse = 1.15 + 0.12 * Math.sin(now / 120); // phóng to nhấp nháy
      const focus = selected || (hint && hint.from);
      game.board.forEach((line, row) =>
        line.forEach((color, col) => {
          if (!color) return;
          const isFocus = focus && focus.row === row && focus.col === col;
          drawBall(row, col, color, isFocus ? pulse : 1);
        }),
      );
    }
  }

  function updateSide() {
    document.getElementById('score').textContent = game.score;
    const next = document.getElementById('next');
    next.innerHTML = '';
    game.nextColors.forEach((color) => {
      const dot = document.createElement('span');
      dot.style.background = COLORS[color];
      next.appendChild(dot);
    });
    if (game.status === 'GAME_OVER') {
      showMessage(message, TEXT.GAME_OVER(game.score), 'error');
    }
  }

  // ---------- Hiệu ứng ----------

  /**
   * Chạy hiệu ứng nước đi: bóng chạy theo đường, sau đó bóng bị xóa thu nhỏ
   * và bóng mới lớn dần. Xong thì hiển thị trạng thái server gửi về.
   */
  function playMove(before, result) {
    const color = before[result.path[0].row][result.path[0].col];
    // Bàn sau khi đi và sinh bóng, trước khi xóa: để biết màu của bóng bị xóa.
    const middle = before.map((line) => [...line]);
    const first = result.path[0];
    const last = result.path[result.path.length - 1];
    middle[first.row][first.col] = 0;
    middle[last.row][last.col] = color;
    result.spawned.forEach((b) => (middle[b.row][b.col] = b.color));

    const start = performance.now();
    const travel = (result.path.length - 1) * STEP_MS;
    animation = {
      draw(now) {
        // `now` của requestAnimationFrame là lúc BẮT ĐẦU khung hình, có thể sớm
        // hơn `start` (lấy lúc nhận phản hồi) vài ms: chặn về 0 để chỉ số đường
        // đi không bị âm (path[-1] là undefined).
        const elapsed = Math.max(0, now - start);
        if (elapsed < travel) {
          // Bóng đang chạy: vẽ bàn cũ, bỏ ô xuất phát, vẽ bóng tại ô trên đường.
          before.forEach((line, row) =>
            line.forEach((c, col) => {
              if (c && !(row === first.row && col === first.col))
                drawBall(row, col, c, 1);
            }),
          );
          const step =
            result.path[
              Math.min(Math.floor(elapsed / STEP_MS), result.path.length - 1)
            ];
          drawBall(step.row, step.col, color, 1);
          return;
        }
        const t = Math.min((elapsed - travel) / FADE_MS, 1);
        const removedKeys = new Set(
          result.removed.map((p) => `${p.row},${p.col}`),
        );
        const spawnedKeys = new Set(
          result.spawned.map((p) => `${p.row},${p.col}`),
        );
        middle.forEach((line, row) =>
          line.forEach((c, col) => {
            if (!c) return;
            const key = `${row},${col}`;
            if (removedKeys.has(key)) drawBall(row, col, c, 1 - t);
            else if (spawnedKeys.has(key)) drawBall(row, col, c, t);
            else drawBall(row, col, c, 1);
          }),
        );
        if (t >= 1) {
          animation = null;
          game = result.game;
          updateSide();
        }
      },
    };
  }

  // ---------- Thao tác ----------

  async function call(event, data) {
    pending = true;
    const res = await Api.emit(socket, event, data);
    pending = false;
    if (!res.ok) showMessage(message, res.message, 'error');
    return res;
  }

  async function load(event) {
    const res = await call(event);
    if (res.ok) {
      game = res.data;
      selected = null;
      hint = null;
      showMessage(message, '');
      updateSide();
    }
  }

  canvas.addEventListener('click', async (e) => {
    if (!game || busy() || game.status !== 'PLAYING') return;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor(
      ((e.clientX - rect.left) * (canvas.width / rect.width)) / CELL,
    );
    const row = Math.floor(
      ((e.clientY - rect.top) * (canvas.height / rect.height)) / CELL,
    );
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;

    if (game.board[row][col]) {
      selected = { row, col }; // chọn (hoặc đổi) bóng
      hint = null;
      showMessage(message, '');
      return;
    }
    if (!selected) return;

    const before = game.board;
    const res = await call('line98:move', { from: selected, to: { row, col } });
    if (res.ok) {
      selected = null;
      hint = null;
      showMessage(
        message,
        res.data.removed.length ? TEXT.REMOVED(res.data.removed.length) : '',
        'ok',
      );
      playMove(before, res.data);
    }
  });

  document.getElementById('hint').addEventListener('click', async () => {
    if (!game || busy()) return;
    const res = await call('line98:hint');
    if (!res.ok) return;
    hint = res.data;
    selected = res.data ? res.data.from : null;
    showMessage(
      message,
      res.data ? TEXT.HINT : TEXT.NO_HINT,
      res.data ? 'ok' : 'error',
    );
  });

  // Không cho bắt đầu ván mới khi đang đi bóng: hiệu ứng kết thúc sẽ ghi đè bàn
  // của ván mới bằng bàn của ván cũ.
  document.getElementById('new-game').addEventListener('click', () => {
    if (!busy()) load('line98:new');
  });
  document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    Api.logout();
  });

  socket.on('connect', () => load('line98:resume'));
  requestAnimationFrame(render);
})();
