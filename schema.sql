-- D1 Database Schema for St. Clair County Site
-- Run with: wrangler d1 execute scc-db --file=./schema.sql

-- Contact form submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_type TEXT NOT NULL CHECK(submission_type IN ('tip', 'document', 'correction', 'general', 'media')),
    name TEXT,
    email TEXT,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    processed_at DATETIME,
    notes TEXT
);

-- Upload metadata
CREATE TABLE IF NOT EXISTS upload_metadata (
    id TEXT PRIMARY KEY,
    r2_key TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    downloaded BOOLEAN DEFAULT FALSE,
    downloaded_at DATETIME
);

-- Rate limiting (stores request timestamps per IP hash)
CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash TEXT NOT NULL,
    timestamp INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_processed ON contact_submissions(processed);
CREATE INDEX IF NOT EXISTS idx_contact_type ON contact_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_uploads_created ON upload_metadata(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(ip_hash, timestamp);
