/**
 * SnakeOS API Client
 * Shared frontend module to communicate with the Express + Supabase backend.
 */
(function () {
  // Smart API Base URL detection:
  // - When hosted online (Vercel, Render, etc.): uses relative ""
  // - When running locally on Express (:3000): uses relative ""
  // - When using Live Server (:5500) or file://: uses "http://localhost:3000"
  const isOnlineHosted =
    window.location.protocol.startsWith("http") &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1");

  const API_BASE = isOnlineHosted
    ? ""
    : window.location.origin.includes(":3000")
    ? ""
    : "http://localhost:3000";

  const SnakeAPI = {
    baseUrl: API_BASE,

    /**
     * Check backend and database connection status
     */
    async checkHealth() {
      try {
        const res = await fetch(`${this.baseUrl}/api/health`);
        if (!res.ok) throw new Error("Health check failed");
        return await res.json();
      } catch (err) {
        return { status: "offline", error: err.message, isSupabaseConfigured: false };
      }
    },

    /**
     * Fetch top leaderboard entries
     * @param {number} limit
     */
    async getLeaderboard(limit = 25) {
      try {
        const res = await fetch(`${this.baseUrl}/api/leaderboard?limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        console.warn("SnakeAPI.getLeaderboard error:", err);
        return { success: false, leaderboard: [], error: err.message };
      }
    },

    /**
     * Log in or register a username
     * @param {string} username
     */
    async login(username) {
      try {
        const res = await fetch(`${this.baseUrl}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login request failed");
        return data;
      } catch (err) {
        console.warn("SnakeAPI.login error:", err);
        throw err;
      }
    },

    /**
     * Submit a game score to Supabase / server
     * @param {string} username
     * @param {number} score
     */
    async submitScore(username, score) {
      try {
        const res = await fetch(`${this.baseUrl}/api/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), score: parseInt(score, 10) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Score submission failed");
        return data;
      } catch (err) {
        console.warn("SnakeAPI.submitScore error:", err);
        throw err;
      }
    },

    /**
     * Fetch player stats and rank by username
     * @param {string} username
     */
    async getPlayer(username) {
      try {
        const res = await fetch(`${this.baseUrl}/api/player/${encodeURIComponent(username.trim())}`);
        if (!res.ok) throw new Error("Player not found");
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  };

  window.SnakeAPI = SnakeAPI;
})();
