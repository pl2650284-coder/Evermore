const bcrypt = require('bcryptjs');
const { getDatabase, getDatabasePath, closeDatabase } = require('./connection');

const schema = `
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS couples (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    partner1_name TEXT NOT NULL,
    partner2_name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    hero_image_url TEXT,
    bio TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY,
    couple_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    location TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    image_url TEXT,
    event_type TEXT DEFAULT 'memory',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    couple_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    taken_at TEXT,
    location TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS photo_tags (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id TEXT PRIMARY KEY,
    couple_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    target_date TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS capsules (
    id TEXT PRIMARY KEY,
    couple_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    capsule_type TEXT DEFAULT 'text',
    unlock_date TEXT NOT NULL,
    is_opened INTEGER DEFAULT 0,
    opened_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    couple_id TEXT NOT NULL,
    achievement_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS letters (
    id TEXT PRIMARY KEY,
    couple_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    receiver TEXT,
    title TEXT,
    content TEXT NOT NULL,
    letter_type TEXT DEFAULT 'love',
    is_draft INTEGER DEFAULT 0,
    read_at TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gifts (
    id TEXT PRIMARY KEY,
    couple_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    gift_type TEXT,
    occasion TEXT,
    given_date TEXT,
    image_url TEXT,
    is_special INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    couple_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    venue TEXT,
    event_date TEXT NOT NULL,
    ticket_type TEXT,
    seat_info TEXT,
    image_url TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_couples_user_id ON couples(user_id);
  CREATE INDEX IF NOT EXISTS idx_timeline_couple_id ON timeline_events(couple_id);
  CREATE INDEX IF NOT EXISTS idx_photos_couple_id ON photos(couple_id);
  CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON photo_tags(photo_id);
  CREATE INDEX IF NOT EXISTS idx_wishlist_couple_id ON wishlist(couple_id);
  CREATE INDEX IF NOT EXISTS idx_capsules_couple_id ON capsules(couple_id);
  CREATE INDEX IF NOT EXISTS idx_achievements_couple_id ON achievements(couple_id);
  CREATE INDEX IF NOT EXISTS idx_letters_couple_id ON letters(couple_id);
  CREATE INDEX IF NOT EXISTS idx_gifts_couple_id ON gifts(couple_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_couple_id ON tickets(couple_id);
`;

const tablesWithUpdatedAt = [
  'admins',
  'users',
  'couples',
  'timeline_events',
  'photos',
  'wishlist',
  'capsules',
  'letters',
  'gifts',
  'tickets',
];

async function migrate() {
  const database = getDatabase();
  database.exec(schema);

  for (const table of tablesWithUpdatedAt) {
    database.exec(`
      CREATE TRIGGER IF NOT EXISTS ${table}_set_updated_at
      AFTER UPDATE ON ${table}
      FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;
    `);
  }

  const adminCount = database.prepare('SELECT COUNT(*) AS count FROM admins').get();
  if (adminCount.count === 0) {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || '123456', 10);
    database.prepare(
      'INSERT INTO admins (id, username, password, name) VALUES (?, ?, ?, ?)'
    ).run(
      `admin-${Date.now()}`,
      process.env.ADMIN_USERNAME || 'Ghjxxj',
      hashedPassword,
      'Administrator'
    );
  }

  database.exec('PRAGMA user_version = 1');
  console.log(`SQLite migration complete: ${getDatabasePath()}`);
}

if (require.main === module) {
  migrate()
    .then(() => closeDatabase())
    .catch((error) => {
      console.error('Migration failed:', error);
      closeDatabase();
      process.exitCode = 1;
    });
}

module.exports = { migrate };
