import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

export function useLaundrySocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      // Play 3 beeps with increasing frequency
      const frequencies = [587.33, 783.99, 1046.50]; // D5, G5, C6
      const startTime = ctx.currentTime;

      frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        const beepStart = startTime + i * 0.3;
        const beepDuration = 0.2;

        gainNode.gain.setValueAtTime(0.3, beepStart);
        gainNode.gain.exponentialRampToValueAtTime(0.01, beepStart + beepDuration);

        oscillator.start(beepStart);
        oscillator.stop(beepStart + beepDuration);
      });
    } catch (err) {
      console.error('Error playing notification sound:', err);
    }
  }, []);

  const showBrowserNotification = useCallback((machineName: string) => {
    const title = '🧺 دورك في المغسلة!';
    const body = `تم استدعاؤك للغسيل. الغسالة: ${machineName}. يرجى التوجه فوراً.`;

    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico', tag: 'laundry-called' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body, icon: '/favicon.ico', tag: 'laundry-called' });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const socket = io({
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join-tenant', user.tenantId);
      socket.emit('join-user', user.id);
    });

    socket.on('laundry-called', (data: { queueId: string; machineName: string; timestamp: string }) => {
      playNotificationSound();
      showBrowserNotification(data.machineName);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      // نقفل AudioContext عشان ميضرش الذاكرة
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [user, playNotificationSound, showBrowserNotification]);

  return null;
}
