'use client';

import { useState, useCallback, useRef } from 'react';

export function useAlert() {
  const [alertActive, setAlertActive] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const playAlertSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      // 停止之前的
      if (oscillatorRef.current) {
        try { oscillatorRef.current.stop(); } catch { /* ignore */ }
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.15); // E5
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3); // A5

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
      oscillatorRef.current = oscillator;
    } catch (error) {
      console.error('报警声音播放失败:', error);
    }
  }, []);

  const triggerAlert = useCallback((message: string) => {
    setAlertActive(true);
    setAlertMessage(message);
    playAlertSound();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setAlertActive(false);
      setAlertMessage('');
    }, 5000);
  }, [playAlertSound]);

  const dismissAlert = useCallback(() => {
    setAlertActive(false);
    setAlertMessage('');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return { alertActive, alertMessage, triggerAlert, dismissAlert };
}
