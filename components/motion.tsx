"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

/**
 * Animation primitives. Subtle by default — no gimmicks.
 * Respects prefers-reduced-motion automatically.
 */

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number;
};

/** Fade-up on scroll into view. Wrap any block. */
export function Reveal({ delay = 0, children, ...props }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Stagger children — wrap a list, give each child <StaggerItem>. */
export function Stagger({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: reduce ? {} : { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
