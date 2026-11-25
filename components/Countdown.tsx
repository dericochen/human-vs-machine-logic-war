"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Countdown({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(3);

  useEffect(() => {
    if (step === 0) {
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s - 1), 850);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.3 }}
          className="mono text-center"
        >
          <div className="neon-text text-8xl font-black tabular-nums md:text-9xl">
            {step === 0 ? "GO" : step}
          </div>
          <div className="mt-4 text-sm uppercase tracking-widest text-inkdim">prepare your eyes</div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
