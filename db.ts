import { Database } from "bun:sqlite";

const db = new Database('db.sqlite');

db.run(`
  CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    remind_at INTEGER NOT NULL,
    published_id TEXT,
    created_at INTEGER NOT NULL,
    raw_event TEXT NOT NULL,
    relays TEXT NOT NULL
  )
`);

export interface Event {
    event_id: string;
    remind_at: number;
    published_id?: string;
    created_at: number;
    raw_event: string;
    relays: string;
}

export function insertEvent(event: Event): void {
    const stmt = db.prepare(`
        INSERT INTO events (event_id, remind_at, published_id, created_at, raw_event, relays)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(event.event_id, event.remind_at, event.published_id, event.created_at, event.raw_event, event.relays);
}

export function updateEventPublished(event_id: string, published_id: string): void {
    const stmt = db.prepare(`
        UPDATE events 
        SET published_id = ?
        WHERE event_id = ?
    `);
    
    stmt.run(published_id, event_id);
}

export function getUpcomingEvents(now: number): Event[] {
    return db.prepare(`
        SELECT * FROM events 
        WHERE remind_at <= ? 
        AND published_id IS NULL
    `).all(now) as Event[];
}

export function deleteEvent(event_id: string): void {
    const stmt = db.prepare(`
        DELETE FROM events 
        WHERE event_id = ?
    `);
    
    stmt.run(event_id);
}

// Export the database instance for potential direct usage
export default db;

