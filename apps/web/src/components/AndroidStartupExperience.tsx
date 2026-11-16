import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion, useReducedMotion } from 'framer-motion';

const STARTUP_DURATION_MS = 520;

export function AndroidStartupExperience() {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android' || reduceMotion) return;

    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), STARTUP_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion]);

  if (!visible) return null;

  return (
    <motion.div
      aria-label="Detsbee"
      className="fixed inset-0 z-[100] grid place-content-center justify-items-center gap-4 bg-[#0B0A10] text-[#F7D98A]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.32, delay: 0.18, ease: 'easeOut' }}
    >
      <motion.img
        src="/detsbee-icon.png"
        alt=""
        className="h-24 w-24 rounded-[1.65rem] shadow-[0_0_44px_rgba(240,196,83,0.16)]"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
      <motion.span
        className="font-display text-2xl font-semibold tracking-wide"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.08, ease: 'easeOut' }}
      >
        Detsbee
      </motion.span>
    </motion.div>
  );
}
