import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { handleEvent } from "./handle-event";
import { runReminders } from "./remind";

const nsec = process.env.REMINDME_NSEC;
if (!nsec) {
  console.log("No nsec available, define REMINDME_NSEC env variable");
  process.exit(1);
}

const signer = new NDKPrivateKeySigner(nsec);

const ndk = new NDK({
  explicitRelayUrls: ["wss://relay.damus.io", 'wss://relay.nostr.band'],
  signer,
});

ndk.pool.on("relay:connect", ({url}: {url: string}) => {
  console.log("Connected to relay: ", url);
});
await ndk.connect(2500);

const user = await signer.user();
console.log('Starting as: ', user.npub);

setTimeout(() => {
  runReminders(ndk);
  
  console.log('Subscribing to events');
  const sub = ndk.subscribe([
    { kinds: [1], "#p": [user.pubkey] }
  ], { closeOnEose: false, groupable: false }, undefined, {
    onEvent: handleEvent,
  });
  sub.start();
}, 2500);

