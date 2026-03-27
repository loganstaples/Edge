import { getDb } from "./index";

export function initializeDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL,
      url TEXT,
      published_at TEXT,
      category TEXT,
      processed INTEGER DEFAULT 0,
      ai_tag TEXT,
      matched_markets INTEGER DEFAULT 0,
      edge_highlight TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      article_id TEXT REFERENCES articles(id),
      event_title TEXT NOT NULL,
      category TEXT,
      ai_probability REAL NOT NULL,
      confidence TEXT NOT NULL,
      resolution_date TEXT,
      reasoning TEXT,
      key_factors TEXT,
      news_sources TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS market_matches (
      id TEXT PRIMARY KEY,
      prediction_id TEXT REFERENCES predictions(id),
      platform TEXT NOT NULL,
      external_id TEXT NOT NULL,
      instrument_symbol TEXT,
      token_id TEXT,
      market_price REAL,
      edge REAL,
      signal_strength TEXT,
      last_updated TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prediction_id TEXT REFERENCES predictions(id),
      platform TEXT NOT NULL,
      price REAL NOT NULL,
      ai_probability REAL NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      author_name TEXT DEFAULT 'anonymous',
      nodes TEXT NOT NULL,
      connections TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      is_public INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS strategy_performance (
      id TEXT PRIMARY KEY,
      strategy_id TEXT REFERENCES strategies(id),
      total_trades INTEGER DEFAULT 0,
      winning_trades INTEGER DEFAULT 0,
      total_pnl REAL DEFAULT 0.0,
      sharpe_ratio REAL DEFAULT 0.0,
      max_drawdown REAL DEFAULT 0.0,
      last_updated TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS execution_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id TEXT REFERENCES strategies(id),
      timestamp TEXT DEFAULT (datetime('now')),
      node_logs TEXT NOT NULL,
      trade_placed INTEGER DEFAULT 0,
      trade_details TEXT,
      pnl_delta REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS simulated_trades (
      id TEXT PRIMARY KEY,
      strategy_id TEXT REFERENCES strategies(id),
      platform TEXT NOT NULL,
      market_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      entry_price REAL NOT NULL,
      amount REAL NOT NULL,
      current_price REAL,
      pnl REAL DEFAULT 0.0,
      status TEXT DEFAULT 'open',
      opened_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_articles_processed ON articles(processed);
    CREATE INDEX IF NOT EXISTS idx_predictions_category ON predictions(category);
    CREATE INDEX IF NOT EXISTS idx_market_matches_prediction ON market_matches(prediction_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_prediction ON price_history(prediction_id);
    CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
    CREATE INDEX IF NOT EXISTS idx_strategies_public ON strategies(is_public);
    CREATE INDEX IF NOT EXISTS idx_execution_log_strategy ON execution_log(strategy_id);
    CREATE INDEX IF NOT EXISTS idx_simulated_trades_strategy ON simulated_trades(strategy_id);

    CREATE TABLE IF NOT EXISTS payment_streams (
      id TEXT PRIMARY KEY,
      strategy_id TEXT REFERENCES strategies(id),
      wallet_address TEXT NOT NULL,
      flow_rate TEXT NOT NULL,
      token TEXT DEFAULT 'USDC',
      total_streamed REAL DEFAULT 0.0,
      status TEXT DEFAULT 'active',
      started_at TEXT DEFAULT (datetime('now')),
      last_tick_at TEXT,
      stopped_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_payment_streams_strategy ON payment_streams(strategy_id);
    CREATE INDEX IF NOT EXISTS idx_payment_streams_wallet ON payment_streams(wallet_address);
  `);

  // --- Migrations: add ownership columns to strategies ---
  const cols = db.prepare("PRAGMA table_info(strategies)").all() as any[];
  const colNames = new Set(cols.map((c: any) => c.name));
  if (!colNames.has("owner_wallet")) {
    db.exec("ALTER TABLE strategies ADD COLUMN owner_wallet TEXT");
  }
  if (!colNames.has("nft_mint")) {
    db.exec("ALTER TABLE strategies ADD COLUMN nft_mint TEXT");
  }

  // Index for fast wallet-based lookups
  db.exec("CREATE INDEX IF NOT EXISTS idx_strategies_owner ON strategies(owner_wallet)");
}
