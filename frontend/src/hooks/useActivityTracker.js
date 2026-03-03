import { useEffect, useRef } from "react";

export default function useActivityTracker(userId, signals = {}) {
  const { isRadioPlaying = false, isYouTubePlaying = false, isTrailerPlaying = false } = signals;
  const intervalRef = useRef(null);
  const signalsRef = useRef({
    isRadioPlaying: false,
    isYouTubePlaying: false,
    isTrailerPlaying: false,
  });

  useEffect(() => {
    signalsRef.current = {
      isRadioPlaying,
      isYouTubePlaying,
      isTrailerPlaying,
    };
  }, [isRadioPlaying, isYouTubePlaying, isTrailerPlaying]);

  useEffect(() => {
    const clearTracker = () => {
      if (!intervalRef.current) return;
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };

    if (!userId) {
      clearTracker();
      return clearTracker;
    }

    const sendActivity = async () => {
      if (!userId) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      const mediaElementsPlaying = typeof document !== "undefined"
        ? Array.from(document.querySelectorAll("audio, video")).some(
            (element) => !element.paused && !element.ended
          )
        : false;

      const { isRadioPlaying: radioPlaying, isYouTubePlaying: youtubePlaying, isTrailerPlaying: trailerPlaying } = signalsRef.current;
      const isConsumingMedia = radioPlaying || youtubePlaying || trailerPlaying || mediaElementsPlaying;

      if (!isConsumingMedia) return;

      try {
        await fetch("http://localhost:5000/api/users/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, minutes: 1 }),
        });
        console.log("[ActivityTracker] +1 minute sent");
      } catch {
      }
    };

    if (!intervalRef.current) {
      intervalRef.current = setInterval(sendActivity, 60000);
    }

    return clearTracker;
  }, [userId]);
}
