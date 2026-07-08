/**
 * Gesture-safe audio playback for Conversation Practice.
 *
 * Mobile Safari blocks autoplay unless the first `play()` runs inside a user
 * gesture call stack. Call `primeFromGesture()` synchronously in click handlers,
 * then chain further clips via `playSequence`.
 */

export type AudioSequenceStep = {
  id: string;
  url: string | null | undefined;
};

export class ConversationAudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private playingId: string | null = null;
  private onPlayingIdChange: ((id: string | null) => void) | null = null;
  private playbackRate = 1;

  attach(onPlayingIdChange?: (id: string | null) => void) {
    if (!this.audio) {
      this.audio = new Audio();
    }
    this.audio.playbackRate = this.playbackRate;
    (this.audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    (this.audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
    (this.audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    this.onPlayingIdChange = onPlayingIdChange ?? null;
    return this.audio;
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    if (this.audio) {
      this.audio.playbackRate = rate;
    }
  }

  dispose() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.playingId = null;
    this.onPlayingIdChange?.(null);
  }

  get isReady(): boolean {
    return this.audio !== null;
  }

  /** Call synchronously inside a click/tap handler to unlock autoplay. */
  primeFromGesture(url?: string | null) {
    const audio = this.audio;
    if (!audio || !url?.trim()) return;

    audio.playbackRate = this.playbackRate;
    audio.src = url;
    void audio.play().catch(() => {
      // Unlock attempt — ignore failures; replay control remains available.
    });
  }

  private setPlayingId(id: string | null) {
    this.playingId = id;
    this.onPlayingIdChange?.(id);
  }

  private playOne(url: string, id: string): Promise<void> {
    const audio = this.audio;
    if (!audio) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };

      this.setPlayingId(id);
      audio.playbackRate = this.playbackRate;
      audio.src = url;
      audio.onended = () => {
        cleanup();
        this.setPlayingId(null);
        resolve();
      };
      audio.onerror = () => {
        cleanup();
        this.setPlayingId(null);
        reject(new Error("Playback failed"));
      };

      void audio.play().catch((error) => {
        cleanup();
        this.setPlayingId(null);
        reject(error);
      });
    });
  }

  async playSequence(steps: AudioSequenceStep[]): Promise<void> {
    for (const step of steps) {
      const url = step.url?.trim();
      if (!url) continue;
      try {
        await this.playOne(url, step.id);
      } catch {
        // Skip failed clips; manual replay remains on each bubble.
      }
    }
  }

  async replayEntry(id: string, url: string | null | undefined): Promise<boolean> {
    const trimmed = url?.trim();
    if (!trimmed) return false;

    try {
      await this.playOne(trimmed, id);
      return true;
    } catch {
      this.setPlayingId(null);
      return false;
    }
  }
}
