import NDK, { NDKEvent, NDKUser } from "@nostr-dev-kit/ndk";
import * as chrono from 'chrono-node';

// Extracts the time at which the reminder should be sent,
// the time could be relative, like "in 10 minutes" or "at 10:00"
export function extractTime(user: NDKUser, event: NDKEvent): number | null {
    const position = npubInContentPosition(user, event, event.ndk!);
    if (position === null) return null;
    
    // Extract text after the mention
    const textAfterMention = event.content.slice(position).trim();
    
    // Create reference date from event.created_at (which is in seconds)
    // Fall back to current time if created_at is undefined (should be rare)
    const referenceDate = event.created_at 
        ? new Date(event.created_at * 1000)
        : new Date();
    
    // Try to parse the date/time from the text using the event creation time as reference
    const parsedDate = chrono.parseDate(textAfterMention, referenceDate);
    if (!parsedDate) return null;
    
    // Return timestamp in milliseconds
    return parsedDate.getTime();
}

/**
 * Returns the position of the first mention of the user in the text,
 * valid cases:
 * nostr:npub1...
 * nostr:nprofile1...
 */
export function npubInContentPosition(user: NDKUser, event: NDKEvent, ndk: NDK): number | null {
    const content = event.content;
    const identifierRegex = /(nostr:)?npub1[a-zA-Z0-9]{58}/g;
    
    let match;
    while ((match = identifierRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const npub = fullMatch.replace('nostr:', '');
        
        try {
            const npubUser = ndk.getUser({ npub });
            if (npubUser?.pubkey === user.pubkey) {
                return match.index + fullMatch.length;
            }
        } catch (e) {
            // Skip invalid identifiers
            continue;
        }
    }
    
    return null;
}