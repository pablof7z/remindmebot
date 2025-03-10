import NDK, { NDKEvent, NDKUser } from "@nostr-dev-kit/ndk";
import * as chrono from 'chrono-node';
import { nip19 } from 'nostr-tools';

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
    
    // Try parsing time from different positions in the text
    const words = textAfterMention.split(/\s+/);
    let parsedDate = null;
    
    // Try first 10 positions or until end of words
    for (let i = 0; i < Math.min(10, words.length); i++) {
        const textToTry = words.slice(i).join(' ');
        parsedDate = chrono.parseDate(textToTry, referenceDate, { forwardDate: true });
        if (parsedDate) break;
    }
    
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
    // Updated regex to match both npub1 and nprofile1 formats with any length
    const identifierRegex = /(nostr:)?(npub1|nprofile1)[a-zA-Z0-9]+/g;
    
    let match;
    while ((match = identifierRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const identifier = fullMatch.replace('nostr:', '');
        
        try {
            let matchedUser;
            
            if (identifier.startsWith('npub1')) {
                // Handle npub case as before
                matchedUser = ndk.getUser({ npub: identifier });
            } else if (identifier.startsWith('nprofile1')) {
                // Handle nprofile case using nip19.decode
                const decoded = nip19.decode(identifier);
                if (decoded.type === 'nprofile') {
                    const profileData = decoded.data;
                    matchedUser = ndk.getUser({ pubkey: profileData.pubkey });
                }
            }
            
            if (matchedUser?.pubkey === user.pubkey) {
                return match.index + fullMatch.length;
            }
        } catch (e) {
            // Skip invalid identifiers
            continue;
        }
    }
    
    return null;
}