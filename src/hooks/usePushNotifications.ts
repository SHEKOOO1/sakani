import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from './useApi';
import { pushSupported, urlBase64ToUint8Array } from '../utils/pushNotifications';

/**
 * Registers this device for Web Push (background notifications).
 *
 * - `enable()` must be called from a user gesture (button click) the first time
 *   so the browser allows the permission prompt.
 * - On later visits, if permission is already granted, it silently re-subscribes
 *   so a device that missed a subscription still gets registered.
 */
export function usePushNotifications(enabled: boolean) {
  const { request } = useApi();
  const [supported, setSupported] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoTriedRef = useRef(false);

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    // على الآيفون لا يعمل Web Push إلا من داخل التطبيق المُضاف للشاشة الرئيسية
    setIosNeedsInstall(isIos && !standalone);
    if (ok) setPermission(Notification.permission);
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!pushSupported()) return false;
    setBusy(true);
    try {
      // اطلب الإذن أولًا (من نفس لمّة المستخدم) قبل أي طلب شبكة، لأن المتصفح
      // يشترط وجود تفاعل مباشر من المستخدم لإظهار نافذة السماح.
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      const keyRes = await request('/api/notifications/vapid-public-key');
      const key: string | null = keyRes?.key || null;
      if (!key) return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }
      await request('/api/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: sub }),
      });
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [request]);

  // إعادة الاشتراك تلقائيًا إن كان الإذن ممنوحًا مسبقًا
  useEffect(() => {
    if (!enabled || !supported || autoTriedRef.current) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      autoTriedRef.current = true;
      void enable();
    }
  }, [enabled, supported, enable]);

  return { supported, iosNeedsInstall, permission, subscribed, busy, enable };
}
