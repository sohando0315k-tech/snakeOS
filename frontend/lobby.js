/**
 * SnakeOS Lobby Controller
 * Handles the animated text grid, player login, and live global leaderboard.
 */

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const usernameInput = document.getElementById("usernameInput");
  const lobbyPlayerName = document.getElementById("lobbyPlayerName");
  const lobbyPersonalBest = document.getElementById("lobbyPersonalBest");
  const lobbyPlayerRank = document.getElementById("lobbyPlayerRank");
  const snakeGrid = document.getElementById("snakeGrid");
  const leaderboardBody = document.getElementById("leaderboardBody");
  const refreshBtn = document.getElementById("refreshBtn");
  const statusDot = document.getElementById("statusDot");
  const connectionText = document.getElementById("connectionText");
  const loginMessage = document.getElementById("loginMessage");

  // =========================================================================
  // 1. Text Art Grid & Snake Weave Animation
  // =========================================================================
  const textArt = [
    "                                                   ",
    "                                                   ",
    "  XXXXX  X   X   XXX   X   X  XXXXX   XXX   XXXXX  ",
    "  X      XX  X  X   X  X  X   X      X   X  X      ",
    "  X      XX  X  X   X  X X    X      X   X  X      ",
    "  XXXXX  X X X  XXXXX  XX     XXXX   X   X  XXXXX  ",
    "      X  X  XX  X   X  X X    X      X   X      X  ",
    "      X  X  XX  X   X  X  X   X      X   X      X  ",
    "  XXXXX  X   X  X   X  X   X  XXXXX   XXX   XXXXX  ",
    "                                                   ",
    "                                                   ",
  ];

  const cellsArray = [];
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 51; c++) {
      const char = textArt[r][c];
      const cell = document.createElement("div");
      let classes = "snake-grid-cell";

      if (char === "X") {
        classes += " text";
        if (c >= 2 && c <= 6) classes += " text-S1";
        else if (c >= 9 && c <= 13) classes += " text-N";
        else if (c >= 16 && c <= 20) classes += " text-A";
        else if (c >= 23 && c <= 27) classes += " text-K";
        else if (c >= 30 && c <= 34) classes += " text-E";
        else if (c >= 37 && c <= 41) classes += " text-O";
        else if (c >= 44 && c <= 48) classes += " text-S2";
      } else {
        if ((r === 1 && c === 4) || (r === 9 && c === 18) || (r === 1 && c === 48)) {
          classes += " cell-wall";
        } else if ((r === 6 && c === 1) || (r === 1 && c === 28) || (r === 9 && c === 46)) {
          classes += " cell-apple";
        } else if ((r === 1 && c === 13) || (r === 8 && c === 7) || (r === 1 && c === 34) || (r === 9 && c === 31)) {
          classes += " cell-poison";
        }
      }

      cell.className = classes;
      snakeGrid.appendChild(cell);
      cellsArray.push(cell);
    }
  }

  // Snake Path Generator
  let snakePath = [];
  function addSeq(x1, y1, x2, y2, isAbove) {
    let stepX = x1 < x2 ? 1 : x1 > x2 ? -1 : 0;
    let stepY = y1 < y2 ? 1 : y1 > y2 ? -1 : 0;
    let x = x1, y = y1;
    while (true) {
      if (
        snakePath.length === 0 ||
        snakePath[snakePath.length - 1].x !== x ||
        snakePath[snakePath.length - 1].y !== y
      ) {
        snakePath.push({ x, y, isAbove });
      }
      if (x === x2 && y === y2) break;
      x += stepX;
      y += stepY;
    }
  }

  addSeq(0, 10, 4, 10, true);
  addSeq(4, 10, 4, 3, true);
  addSeq(4, 3, 7, 3, true);
  addSeq(7, 3, 7, 10, false);
  addSeq(7, 10, 11, 10, false);
  addSeq(11, 10, 11, 2, false);
  addSeq(11, 2, 14, 2, false);
  addSeq(14, 2, 14, 6, true);
  addSeq(14, 6, 18, 6, true);
  addSeq(18, 6, 18, 2, true);
  addSeq(18, 2, 21, 2, true);
  addSeq(21, 2, 21, 9, false);
  addSeq(21, 9, 25, 9, false);
  addSeq(25, 9, 25, 4, false);
  addSeq(25, 4, 28, 4, false);
  addSeq(28, 4, 28, 10, true);
  addSeq(28, 10, 32, 10, true);
  addSeq(32, 10, 32, 5, true);
  addSeq(32, 5, 39, 5, false);
  addSeq(39, 5, 39, 3, true);
  addSeq(39, 3, 40, 3, true);
  addSeq(40, 3, 40, 7, true);
  addSeq(40, 7, 38, 7, true);
  addSeq(38, 7, 38, 5, true);
  addSeq(38, 5, 39, 5, true);

  let body = [];
  let headIndex = 0;
  let length = 8;

  function drawGrid() {
    cellsArray.forEach((c) => {
      c.style.backgroundColor = "";
      c.style.boxShadow = "";
      c.style.zIndex = "";
    });

    for (let i = 0; i < body.length; i++) {
      let p = snakePath[body[i]];
      if (!p) continue;
      let index = p.y * 51 + p.x;
      let cell = cellsArray[index];
      if (!cell) continue;

      if (p.isAbove || !cell.classList.contains("text")) {
        cell.style.backgroundColor = "#00ff00";
        cell.style.boxShadow = "none";
        if (p.isAbove) cell.style.zIndex = "10";
      }
    }
  }

  function slither() {
    if (headIndex < snakePath.length + length) {
      if (headIndex < snakePath.length) body.push(headIndex);
      if (body.length > length || headIndex >= snakePath.length) body.shift();
      headIndex++;
      drawGrid();
      setTimeout(slither, 60);
    } else {
      setTimeout(() => {
        body = [];
        headIndex = 0;
        slither();
      }, 2500);
    }
  }

  setTimeout(slither, 500);

  // =========================================================================
  // 2. Player State & Status Sync
  // =========================================================================
  function updatePlayerCardUI(username, highScore, rank) {
    if (lobbyPlayerName) lobbyPlayerName.textContent = username || "Guest";
    if (lobbyPersonalBest) lobbyPersonalBest.textContent = highScore ?? 0;
    if (lobbyPlayerRank) {
      lobbyPlayerRank.textContent = rank ? (typeof rank === "number" ? "#" + rank : rank) : "--";
    }
  }

  const storedUsername = localStorage.getItem("snakeUsername");
  const storedScore = parseInt(localStorage.getItem("snakeHighScore") || "0", 10);
  const storedRank = localStorage.getItem("snakePlayerRank");

  if (storedUsername) {
    if (usernameInput) usernameInput.value = storedUsername;
    updatePlayerCardUI(storedUsername, storedScore, storedRank);
  }

  // Rank Badge Formatter
  function formatRank(rank) {
    if (rank === 1) return '<span class="rank-medal rank-1">🥇 1</span>';
    if (rank === 2) return '<span class="rank-medal rank-2">🥈 2</span>';
    if (rank === 3) return '<span class="rank-medal rank-3">🥉 3</span>';
    return `<span class="rank-medal" style="color:#9ca3af;">#${rank}</span>`;
  }

  // Connection Status Check
  async function checkConnection() {
    const health = await window.SnakeAPI.checkHealth();
    if (health.isSupabaseConfigured) {
      statusDot.className = "status-dot";
      connectionText.textContent = "Supabase Live";
    } else if (health.status === "online") {
      statusDot.className = "status-dot warning";
      connectionText.textContent = "Local Server";
    } else {
      statusDot.className = "status-dot error";
      connectionText.textContent = "Offline Mode";
    }
  }

  // =========================================================================
  // 3. Live Leaderboard Fetching
  // =========================================================================
  async function fetchLeaderboard() {
    try {
      if (refreshBtn) refreshBtn.classList.add("loading");
      const res = await window.SnakeAPI.getLeaderboard(25);
      const list = res.leaderboard || [];

      leaderboardBody.innerHTML = "";

      const currentActiveUser = (
        window.activePlayer?.username ||
        localStorage.getItem("snakeUsername") ||
        ""
      ).toLowerCase();

      if (list.length === 0) {
        leaderboardBody.innerHTML =
          '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 30px 0;">No scores recorded yet. Be the first!</td></tr>';
        return;
      }

      let foundActiveInTop = false;

      list.forEach((item) => {
        const tr = document.createElement("tr");
        const isCurrent = currentActiveUser && item.username.toLowerCase() === currentActiveUser;

        if (isCurrent) {
          tr.classList.add("active-player-row");
          foundActiveInTop = true;
          updatePlayerCardUI(item.username, item.highScore, item.rank);
          localStorage.setItem("snakePlayerRank", item.rank.toString());
        }

        tr.innerHTML = `
          <td>${formatRank(item.rank)}</td>
          <td style="font-weight: ${isCurrent ? "bold" : "normal"};">
            ${item.username} ${isCurrent ? '<span style="font-size:0.8rem; color:#00ff88;">(You)</span>' : ""}
          </td>
          <td>${Number(item.highScore).toLocaleString()}</td>
        `;
        leaderboardBody.appendChild(tr);
      });

      // If player is not in top ranks, fetch their individual rank
      if (currentActiveUser && !foundActiveInTop) {
        const playerRes = await window.SnakeAPI.getPlayer(currentActiveUser);
        if (playerRes.success && playerRes.player) {
          updatePlayerCardUI(playerRes.player.username, playerRes.player.highScore, playerRes.player.rank);
          localStorage.setItem("snakePlayerRank", playerRes.player.rank.toString());
        }
      }
    } catch (err) {
      console.warn("Leaderboard error:", err);
      leaderboardBody.innerHTML =
        '<tr><td colspan="3" style="text-align: center; color: #9ca3af; padding: 30px 0;">Start server (`npm start`) to view live scores.</td></tr>';
    } finally {
      if (refreshBtn) refreshBtn.classList.remove("loading");
    }
  }

  // =========================================================================
  // 4. Login Logic
  // =========================================================================
  async function handleLogin(event) {
    if (event && event.preventDefault) event.preventDefault();

    const inputName = usernameInput.value.trim();
    if (!inputName) {
      loginMessage.style.color = "#ef4444";
      loginMessage.textContent = "Please enter a username.";
      usernameInput.focus();
      return;
    }

    if (inputName.length < 2 || inputName.length > 25) {
      loginMessage.style.color = "#ef4444";
      loginMessage.textContent = "Username must be between 2 and 25 characters.";
      return;
    }

    try {
      loginBtn.disabled = true;
      loginBtn.textContent = "Entering...";
      loginMessage.style.color = "#00ff88";
      loginMessage.textContent = "Connecting to profile...";

      const res = await window.SnakeAPI.login(inputName);

      if (res.success && res.player) {
        const p = res.player;
        if (window.updateActivePlayer) {
          window.updateActivePlayer(p.id, p.username, p.highScore);
        } else {
          localStorage.setItem("snakeUserId", p.id);
          localStorage.setItem("snakeUsername", p.username);
          localStorage.setItem("snakeHighScore", p.highScore.toString());
        }

        if (p.rank) localStorage.setItem("snakePlayerRank", p.rank.toString());
        updatePlayerCardUI(p.username, p.highScore, p.rank);

        loginMessage.textContent = "Profile verified! Launching game...";
        setTimeout(() => {
          window.location.href = "index.html";
        }, 400);
        return;
      }
      throw new Error("Login failed");
    } catch (error) {
      console.warn("Server login offline fallback:", error);
      let highScore = 0;
      let playerId = "local-" + Date.now();

      if (
        window.activePlayer &&
        window.activePlayer.username &&
        window.activePlayer.username.toLowerCase() === inputName.toLowerCase()
      ) {
        highScore = window.activePlayer.highScore || 0;
        playerId = window.activePlayer.id || playerId;
      } else if (
        (localStorage.getItem("snakeUsername") || "").toLowerCase() === inputName.toLowerCase()
      ) {
        highScore = parseInt(localStorage.getItem("snakeHighScore") || "0", 10) || 0;
      }

      if (window.updateActivePlayer) {
        window.updateActivePlayer(playerId, inputName, highScore);
      } else {
        localStorage.setItem("snakeUserId", playerId);
        localStorage.setItem("snakeUsername", inputName);
        localStorage.setItem("snakeHighScore", highScore.toString());
      }
      localStorage.removeItem("snakePlayerRank");
      updatePlayerCardUI(inputName, highScore, "--");

      loginMessage.style.color = "#eab308";
      loginMessage.textContent = "Offline mode: launching game...";
      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Play Game ➔";
    }
  }

  // Event Listeners
  if (loginBtn) loginBtn.addEventListener("click", handleLogin);
  if (usernameInput) {
    usernameInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") handleLogin(e);
    });
  }
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      fetchLeaderboard();
      checkConnection();
    });
  }

  // Initial runs
  checkConnection();
  fetchLeaderboard();
  setInterval(fetchLeaderboard, 20000);
});
