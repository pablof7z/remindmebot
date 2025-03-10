import { NDKEvent, NDKUser } from "@nostr-dev-kit/ndk";
import { extractTime } from "./time";
import db, { Event, insertEvent } from "./db";

export async function handleEvent(event: NDKEvent) {
    const userBot = await event.ndk!.signer!.user();
    if (event.pubkey === userBot.pubkey) return;

    console.log('Received event', event.content);

    event.rea

    // Check if event already exists in database
    const existingEvent = db.prepare("SELECT event_id FROM events WHERE event_id = ?").get(event.id);
    if (existingEvent) return;

    console.log('Will analyze', event.content);

    // Get the bot's user instance
    const botUser = await event.ndk!.signer!.user();
    
    // Extract the reminder time
    const remindAt = extractTime(botUser, event);
    if (!remindAt) {
        console.log("\x1b[31m❌ Could not extract reminder time from event\x1b[0m", event.content, event.encode());
        return;
    }

    // Create and save the new event
    const newEvent: Event = {
        event_id: event.id,
        remind_at: remindAt,
        created_at: Date.now(),
        raw_event: JSON.stringify(event.rawEvent()),
        relays: JSON.stringify(event.onRelays.map(r => r.url))
    };

    insertEvent(newEvent);
    const distanceOfTimeInWords = distanceOfTimeInWordsToNow(remindAt);
    console.log("\x1b[32m✅ Saved reminder for\x1b[0m", new Date(remindAt).toLocaleString(), distanceOfTimeInWords);

    reactWithOk(event);
}


function distanceOfTimeInWordsToNow(remindAt: number): string {
    const now = Date.now();
    const diff = remindAt - now;
    const diffInSeconds = Math.abs(diff / 1000);
    
    const minutes = Math.floor(diffInSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} ${days === 1 ? 'day' : 'days'}`;
    } else if (hours > 0) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else if (minutes > 0) {
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    } else {
        return `${Math.round(diffInSeconds)} ${Math.round(diffInSeconds) === 1 ? 'second' : 'seconds'}`;
    }
}

function reactWithOk(event: NDKEvent) {
    event.react('🫡', true);
    console.log('🫡', event.content);
}