import type React from "react";
import { useEffect, useState } from "react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL = 80;

export function LoadingSpinner(): React.ReactNode {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  return <span>{SPINNER_FRAMES[frameIndex]}</span>;
}
