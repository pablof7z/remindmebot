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
  explicitRelayUrls: ["wss://relay.primal.net", "wss://f7z.io"],
  signer,
});

ndk.pool.on("relay:connect", ({url}: {url: string}) => {
  console.log("Connected to relay: ", url);
});
await ndk.connect(2500);

const user = await signer.user();
console.log('Starting as: ', user.npub, `(${user.pubkey})`);

const oneWeekAgo = Math.floor(Date.now()/1000) - 7 * 24 * 60 * 60;

setTimeout(() => {
  
  runReminders(ndk);

  console.log('Subscribing to events', { since: oneWeekAgo });
  
  const sub = ndk.subscribe([
    { kinds: [1], "#p": [user.pubkey], since: oneWeekAgo }
  ], { closeOnEose: false, groupable: false }, undefined, {
    onEvent: handleEvent,
  });
  sub.start();
}, 2500);

