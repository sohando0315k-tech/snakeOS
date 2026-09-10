const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

// Validate Supabase credentials
const isSupabaseConfigured =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_KEY) &&
  !SUPABASE_URL.includes('your-project-id') &&
  !SUPABASE_KEY.includes('your-supabase-anon');

let supabase = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase client initialized with URL:', SUPABASE_URL);
  } catch (err) {
    console.error('⚠️ Failed to initialize Supabase client:', err.message);
  }
} else {
  console.warn('⚠️ Supabase credentials not configured in backend/.env. Running in local fallback mode.');
}

// In-memory fallback store if Supabase is offline or not configured yet
const memoryLeaderboard = new Map();

// Helper to calculate rank in Supabase
async function getSupabasePlayerRank(highScore) {
  if (!supabase) return 1;
  const { count, error } = await supabase
    .from('leaderboard')
    .select('*', { count: 'exact', head: true })
    .gt('high_score', highScore);

  if (error) {
    console.error('Error calculating rank:', error.message);
    return 1;
  }
  return (count || 0) + 1;
}

// Helper to calculate rank in fallback store
function getMemoryPlayerRank(highScore) {
  let higherCount = 0;
  for (const player of memoryLeaderboard.values()) {
    if (player.high_score > highScore) higherCount++;
  }
  return higherCount + 1;
}

// Middleware
// Handle potential /frontend/ prefix from Vercel rewrites gracefully
app.use((req, res, next) => {
  if (req.url.startsWith('/frontend/frontend/')) {
    return res.redirect(req.url.replace('/frontend/frontend/', '/'));
  }
  next();
});

// 1. Explicitly redirect root / directly to /lobby.html
app.get('/', (req, res) => {
  res.redirect('/lobby.html');
});

// 2. Serve static frontend files
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir, { index: false }));
app.use('/frontend', express.static(frontendDir, { index: false }));
app.use(express.static(path.join(__dirname, '../snake'), { index: false }));

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * Health Check & Status
 */
app.get('/api/health', async (req, res) => {
  let dbStatus = 'not_configured';
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('leaderboard').select('count', { count: 'exact', head: true });
    dbStatus = error ? `error: ${error.message}` : 'connected';
  }

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    isSupabaseConfigured,
    dbStatus
  });
});

/**
 * GET /api/leaderboard
 * Fetch top players sorted by high score descending
 */
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('id, username, high_score, updated_at')
        .order('high_score', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      const leaderboard = (data || []).map((row, index) => ({
        rank: index + 1,
        id: row.id,
        username: row.username,
        highScore: row.high_score,
        updatedAt: row.updated_at
      }));

      return res.json({ success: true, source: 'supabase', leaderboard });
    }

    // Fallback: in-memory store
    const sorted = Array.from(memoryLeaderboard.values())
      .sort((a, b) => b.high_score - a.high_score || new Date(a.updated_at) - new Date(b.updated_at))
      .slice(0, limit)
      .map((row, index) => ({
        rank: index + 1,
        id: row.id,
        username: row.username,
        highScore: row.high_score,
        updatedAt: row.updated_at
      }));

    return res.json({ success: true, source: 'memory_fallback', leaderboard: sorted });
  } catch (err) {
    console.error('GET /api/leaderboard Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/login
 * User login by username. If user doesn't exist, create an ID with 0 high score.
 */
app.post('/api/login', async (req, res) => {
  try {
    let { username } = req.body;
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ success: false, error: 'Username is required' });
    }

    username = username.trim();
    if (username.length < 2 || username.length > 25) {
      return res.status(400).json({ success: false, error: 'Username must be between 2 and 25 characters' });
    }

    if (isSupabaseConfigured && supabase) {
      const { data: existingUser, error: findError } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (findError) throw findError;

      if (existingUser) {
        const rank = await getSupabasePlayerRank(existingUser.high_score);
        return res.json({
          success: true,
          player: {
            id: existingUser.id,
            username: existingUser.username,
            highScore: existingUser.high_score,
            rank
          }
        });
      }

      // User does not exist, create new record
      const { data: newUser, error: insertError } = await supabase
        .from('leaderboard')
        .insert([{ username, high_score: 0 }])
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          const { data: retryUser } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('username', username)
            .single();

          if (retryUser) {
            const rank = await getSupabasePlayerRank(retryUser.high_score);
            return res.json({
              success: true,
              player: {
                id: retryUser.id,
                username: retryUser.username,
                highScore: retryUser.high_score,
                rank
              }
            });
          }
        }
        throw insertError;
      }

      const rank = await getSupabasePlayerRank(0);
      return res.json({
        success: true,
        player: {
          id: newUser.id,
          username: newUser.username,
          highScore: newUser.high_score,
          rank
        }
      });
    }

    // Fallback: in-memory store
    let user = memoryLeaderboard.get(username.toLowerCase());
    if (!user) {
      user = {
        id: 'mem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        username,
        high_score: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryLeaderboard.set(username.toLowerCase(), user);
    }

    const rank = getMemoryPlayerRank(user.high_score);
    return res.json({
      success: true,
      player: {
        id: user.id,
        username: user.username,
        highScore: user.high_score,
        rank
      }
    });
  } catch (err) {
    console.error('POST /api/login Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/score
 * Submit a score for a username. If it's a new high score, update Supabase.
 */
app.post('/api/score', async (req, res) => {
  try {
    let { username, score } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: 'Username is required' });
    }

    username = username.trim();
    score = parseInt(score, 10);
    if (isNaN(score) || score < 0) {
      return res.status(400).json({ success: false, error: 'Invalid score' });
    }

    if (isSupabaseConfigured && supabase) {
      const { data: user, error: findError } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (findError) throw findError;

      let currentHighScore = user ? user.high_score : 0;
      let isNewHighScore = false;

      if (!user) {
        isNewHighScore = true;
        const { error: insertError } = await supabase
          .from('leaderboard')
          .insert([{ username, high_score: score }])
          .select()
          .single();

        if (insertError) throw insertError;
        currentHighScore = score;
      } else if (score > currentHighScore) {
        isNewHighScore = true;
        currentHighScore = score;

        const { error: updateError } = await supabase
          .from('leaderboard')
          .update({
            high_score: score,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) throw updateError;
      }

      const rank = await getSupabasePlayerRank(currentHighScore);

      return res.json({
        success: true,
        isNewHighScore,
        highScore: currentHighScore,
        rank,
        submittedScore: score
      });
    }

    // Fallback: in-memory store
    let user = memoryLeaderboard.get(username.toLowerCase());
    let isNewHighScore = false;
    let currentHighScore = 0;

    if (!user) {
      isNewHighScore = true;
      currentHighScore = score;
      user = {
        id: 'mem-' + Date.now(),
        username,
        high_score: score,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryLeaderboard.set(username.toLowerCase(), user);
    } else {
      currentHighScore = user.high_score;
      if (score > currentHighScore) {
        isNewHighScore = true;
        user.high_score = score;
        user.updated_at = new Date().toISOString();
        currentHighScore = score;
      }
    }

    const rank = getMemoryPlayerRank(currentHighScore);
    return res.json({
      success: true,
      isNewHighScore,
      highScore: currentHighScore,
      rank,
      submittedScore: score
    });
  } catch (err) {
    console.error('POST /api/score Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/player/:username
 * Fetch player profile and current global rank
 */
app.get('/api/player/:username', async (req, res) => {
  try {
    const username = req.params.username.trim();

    if (isSupabaseConfigured && supabase) {
      const { data: user, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error) throw error;
      if (!user) {
        return res.status(404).json({ success: false, error: 'Player not found' });
      }

      const rank = await getSupabasePlayerRank(user.high_score);
      return res.json({
        success: true,
        player: {
          id: user.id,
          username: user.username,
          highScore: user.high_score,
          rank,
          updatedAt: user.updated_at
        }
      });
    }

    const user = memoryLeaderboard.get(username.toLowerCase());
    if (!user) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    const rank = getMemoryPlayerRank(user.high_score);
    return res.json({
      success: true,
      player: {
        id: user.id,
        username: user.username,
        highScore: user.high_score,
        rank,
        updatedAt: user.updated_at
      }
    });
  } catch (err) {
    console.error('GET /api/player Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server locally if run directly, or export for Vercel
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 SnakeOS Server running on http://localhost:${PORT}`);
    console.log(`🎮 Lobby: http://localhost:${PORT}/lobby.html`);
    console.log(`🎮 Game:  http://localhost:${PORT}/index.html`);
    console.log(`📊 Supabase: ${isSupabaseConfigured ? 'CONNECTED' : 'WAITING FOR .ENV'}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
