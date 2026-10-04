/**
 * A channel for asking the music player to start or stop from elsewhere (the
 * loading screen's "enter with / without music" buttons). Requests are
 * delivered synchronously, so a request made in a click handler reaches
 * `audio.play()` inside the same user gesture.
 */
type Listener = (on: boolean) => void;

const listeners = new Set<Listener>();

export function requestMusic(on: boolean) {
  listeners.forEach((listener) => listener(on));
}

export function subscribeMusicRequests(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
