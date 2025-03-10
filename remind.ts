// create a function that will check the database for events that are due to be published
// and publish them

import NDK, { NDKEvent, NDKRelaySet } from "@nostr-dev-kit/ndk";
import db, { Event } from "./db";
import { getRandomReminder } from "./text";

export async function remind(ndk: NDK) {
    const now = Date.now();
    const events = db.prepare("SELECT * FROM events WHERE remind_at <= ? AND published_id IS NULL").all(now) as Event[];

    console.log('Found', events.length, 'events to remind');

    for (const event of events) {
        const rawEvent = JSON.parse(event.raw_event);
        const relays = JSON.parse(event.relays) as string[];

        console.log('event', rawEvent.content);
        
        // Create NDKEvent from raw data
        const originalEvent = new NDKEvent(ndk, rawEvent);

        const reply = originalEvent.reply();
        reply.content = getReplyContent(originalEvent);
        await reply.sign();
        await reply.publish();

        if (relays.length > 0) {
            const relaySet = NDKRelaySet.fromRelayUrls(relays, ndk);
            try {
                await reply.publish(relaySet);
            } catch (error) {
                console.error('Error publishing to relay', error);
            }
        }

        console.log('marking as published', originalEvent.encode());
        markAsPublished(originalEvent, reply);
        await sleep(1500);
    }
}

export function runReminders(ndk: NDK) {
    remind(ndk);
    
    setInterval(() => {
        remind(ndk);
    }, 10000);
}

function getReplyContent(originalEvent: NDKEvent): string {
    return getRandomReminder(originalEvent.author.nprofile);
}

function markAsPublished(originalEvent: NDKEvent, reply: NDKEvent) {
    db.prepare("UPDATE events SET published_id = ? WHERE event_id = ?").run(reply.encode(), originalEvent.id);
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}