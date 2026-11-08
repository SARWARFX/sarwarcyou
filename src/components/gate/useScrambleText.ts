import { useState, useEffect, useRef } from 'react';

const GLYPHS = '!@#$%&01XZ_<>~/';

/**
 * useScrambleText
 * Simulates a cryptographic hacker text-scramble decryption effect
 * over a given duration (default 350ms).
 */
export function useScrambleText(targetText: string, isTriggered: boolean, durationMs = 350): string {
  const [displayText, setDisplayText] = useState<string>(isTriggered ? targetText : '');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTriggered) {
      setDisplayText('');
      return;
    }

    const length = targetText.length;
    const startTime = performance.now();

    const update = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Number of characters already resolved
      const resolvedCount = Math.floor(progress * length);

      let result = '';
      for (let i = 0; i < length; i++) {
        if (targetText[i] === ' ') {
          result += ' ';
        } else if (i < resolvedCount) {
          result += targetText[i];
        } else {
          result += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }

      setDisplayText(result);

      if (progress < 1) {
        timerRef.current = window.setTimeout(update, 28);
      } else {
        setDisplayText(targetText);
      }
    };

    update();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [targetText, isTriggered, durationMs]);

  return displayText || targetText;
}
