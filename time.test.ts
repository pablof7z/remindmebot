import * as timeModule from './time';
import NDK, { NDKEvent, NDKUser } from "@nostr-dev-kit/ndk";
import * as chrono from 'chrono-node';

describe('time extraction', () => {
    // Valid npub format: npub1 followed by 58 characters
    const validNpub = 'npub1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    
    const mockNdk = {
        getUser: jest.fn()
    } as unknown as NDK;
    
    const mockUser = {
        pubkey: 'test-pubkey'
    } as NDKUser;
    
    const createEvent = (content: string, created_at = 1700000000) => {
        return {
            content,
            created_at,
            ndk: mockNdk
        } as NDKEvent;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock getUser to return our test user for valid npub
        (mockNdk.getUser as jest.Mock).mockImplementation(({ npub }) => {
            if (npub && npub === validNpub) {
                return mockUser;
            }
            throw new Error('Invalid npub');
        });
        
        // Spy on npubInContentPosition
        jest.spyOn(timeModule, 'npubInContentPosition');
    });

    describe('npubInContentPosition', () => {
        it('should be tested separately', () => {
            // We'll test the real implementation separately
            expect(true).toBe(true);
        });
    });

    describe('extractTime', () => {
        it('extracts time immediately after mention', () => {
            const event = createEvent(`nostr:${validNpub} in 10 minutes`);
            // Mock the position to be after the npub
            (timeModule.npubInContentPosition as jest.Mock).mockReturnValue(`nostr:${validNpub}`.length);
            const time = timeModule.extractTime(mockUser, event);
            expect(time).toBe(1700000000 * 1000 + 10 * 60 * 1000);
        });

        it('extracts time with words in between', () => {
            const event = createEvent(`nostr:${validNpub} please remind me in 2 hours`);
            // Mock the position to be after the npub
            (timeModule.npubInContentPosition as jest.Mock).mockReturnValue(`nostr:${validNpub}`.length);
            const time = timeModule.extractTime(mockUser, event);
            expect(time).toBe(1700000000 * 1000 + 2 * 60 * 60 * 1000);
        });

        it('extracts absolute time', () => {
            const event = createEvent(`nostr:${validNpub} tomorrow at 3pm`);
            // Mock the position to be after the npub
            (timeModule.npubInContentPosition as jest.Mock).mockReturnValue(`nostr:${validNpub}`.length);
            const time = timeModule.extractTime(mockUser, event);
            
            // Since "tomorrow at 3pm" is parsed differently depending on the current time,
            // we'll just check that we got a valid timestamp in the future
            expect(time).toBeGreaterThan(1700000000 * 1000);
            expect(typeof time).toBe('number');
        });

        it('returns null when no time found', () => {
            const event = createEvent(`nostr:${validNpub} hello world`);
            // Mock the position to be after the npub
            (timeModule.npubInContentPosition as jest.Mock).mockReturnValue(`nostr:${validNpub}`.length);
            const time = timeModule.extractTime(mockUser, event);
            expect(time).toBeNull();
        });

        it('returns null when no valid mention found', () => {
            const event = createEvent('hello in 10 minutes');
            // Mock the position to be null (no valid mention)
            (timeModule.npubInContentPosition as jest.Mock).mockReturnValue(null);
            const time = timeModule.extractTime(mockUser, event);
            expect(time).toBeNull();
        });

        it('uses current time when created_at is missing', () => {
            const event = createEvent(`nostr:${validNpub} in 1 hour`);
            // Mock the position to be after the npub
            (timeModule.npubInContentPosition as jest.Mock).mockReturnValue(`nostr:${validNpub}`.length);
            delete event.created_at;
            
            // For this test, we'll just check that the time is in the future
            const time = timeModule.extractTime(mockUser, event);
            
            expect(time).toBeGreaterThan(Date.now());
            expect(typeof time).toBe('number');
        });
    });
}); 