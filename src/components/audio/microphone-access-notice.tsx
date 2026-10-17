"use client";

import { useEffect, useState } from "react";
import type { MicrophoneFailure } from "@/lib/audio/microphone-access-message";
import { isNativeApp, nativePlatform } from "@/lib/native/platform";

export function MicrophoneAccessNotice({ failure }: { failure: MicrophoneFailure }) {
  const [android, setAndroid] = useState(false);
  useEffect(() => {
    setAndroid(isNativeApp() && nativePlatform() === "android");
  }, []);

  if (failure.kind === "blocked") {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950">
        <p>{failure.title}</p>
        {android ? (
          <p className="mt-2">Android: Settings → Apps → Kidda → Permissions → Microphone → Allow.</p>
        ) : (
          <>
            <p className="mt-2">{failure.iphone}</p>
            <p className="mt-1">{failure.chrome}</p>
          </>
        )}
      </div>
    );
  }

  return <p className="mt-3 text-sm text-red-600">{failure.message}</p>;
}
