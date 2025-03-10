import * as timeModule from './time';
import NDK, { NDKEvent, NDKUser, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import * as chrono from 'chrono-node';
import { nip19 } from 'nostr-tools';

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
        (mockNdk.getUser as jest.Mock).mockImplementation(({ npub, pubkey }) => {
            if ((npub && npub === validNpub) || (pubkey && pubkey === 'test-pubkey')) {
                return mockUser;
            }
            throw new Error('Invalid npub or pubkey');
        });
        
        // Mock npubInContentPosition
        jest.spyOn(timeModule, 'npubInContentPosition').mockImplementation(
            (user, event) => {
                // For test purposes, just check if the validNpub is in the content
                if (event.content.includes(validNpub)) {
                    return event.content.indexOf(validNpub) + validNpub.length;
                }
                return null;
            }
        );
    });

    describe('npubInContentPosition', () => {
        // Remove the mock for these specific tests
        beforeEach(() => {
            if ((timeModule.npubInContentPosition as any).mockRestore) {
                (timeModule.npubInContentPosition as any).mockRestore();
            }
        });
        
        it('should find npub1 in content', () => {
            // Set up the mock to return the user for this specific npub
            (mockNdk.getUser as jest.Mock).mockImplementation(({ npub }) => {
                if (npub === validNpub) {
                    return mockUser;
                }
                throw new Error('Invalid npub');
            });
            
            const event = createEvent(`nostr:${validNpub} hello`);
            const position = timeModule.npubInContentPosition(mockUser, event, mockNdk);
            expect(position).toBe((`nostr:${validNpub}`).length);
        });
        
        it('should find nprofile1 in content', async () => {
            // Generate a real signer and user
            const signer = await NDKPrivateKeySigner.generate();
            const testUser = await signer.user();
            
            // Get the nprofile
            const nprofile = testUser.nprofile;
            
            // Update the mock user to match the generated user
            mockUser.pubkey = testUser.pubkey;
            
            // Set up the mock to return the user for this specific pubkey
            (mockNdk.getUser as jest.Mock).mockImplementation(({ pubkey }) => {
                if (pubkey === testUser.pubkey) {
                    return mockUser;
                }
                throw new Error('Invalid pubkey');
            });
            
            const event = createEvent(`nostr:${nprofile} hello`);
            const position = timeModule.npubInContentPosition(mockUser, event, mockNdk);
            expect(position).toBe((`nostr:${nprofile}`).length);
        });
        
        it('should return null for non-matching npub', () => {
            const event = createEvent('nostr:npub1nonmatchingxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx hello');
            const position = timeModule.npubInContentPosition(mockUser, event, mockNdk);
            expect(position).toBeNull();
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

        it('handles real-world event with npub in the middle of text', () => {
            // Real event from the wild
            const realEvent = {
                kind: 1,
                id: "4509ff57e931e62e2aa5782897dce5e648fe93a0bc7629df97bdea8ea24372a2",
                pubkey: "958b754a1d3de5b5eca0fe31d2d555f451325f8498a83da1997b7fcd5c39e88c",
                created_at: 1741624004,
                tags: [
                    ["e", "23fad99987f384b923efc983cddc7c62f5de1b53710e84e01bdb01bd8cfe9cd6", "", "root"],
                    ["e", "a96b6df40b72a7b3e2c61ea12c4c269ee386d8573ef27d250acb780f6f7d1b23", "", "reply"],
                    ["p", "f5e1ca21aaac17b173991399d6233c73bb854633489142b524ba6a9667e79aa0"],
                    ["p", "fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52"],
                    ["p", "f5e1ca21aaac17b173991399d6233c73bb854633489142b524ba6a9667e79aa0"]
                ],
                content: "there's no way it doesn't go down with the amount of traffic it's about to get \n\nnostr:npub17hsu5gd24stmzuuezwvavgeuwwac233nfzg59dfyhf4fvel8n2sqw3d0k9 in 5 minutes",
                sig: "5689d74209df05968073844454fc9561e8c72c95b8e5dbc0ce53e9e5f612f7bbf8facbcf6af7d115f64406ffe80bb54a1808f451659eab8914e2b55f26fc0446",
                ndk: mockNdk
            } as NDKEvent;

            // Mock the position to be after the npub
            const npubPosition = "there's no way it doesn't go down with the amount of traffic it's about to get \n\nnostr:npub17hsu5gd24stmzuuezwvavgeuwwac233nfzg59dfyhf4fvel8n2sqw3d0k9".length;
            (timeModule.npubInContentPosition as jest.Mock).mockReturnValue(npubPosition);
            
            const time = timeModule.extractTime(mockUser, realEvent);
            
            // Should be 5 minutes after created_at
            expect(time).toBe(1741624004 * 1000 + 5 * 60 * 1000);
        });
    });
}); 