import { useEffect, useRef } from "react";
import { motion, useAnimation, useInView } from "framer-motion";

/**
 * Reprend l'effet "BoxReveal" du composant de référence (slide-up + fade
 * suivi d'une bande de couleur qui balaie le contenu au montage) — adapté en
 * pur CSS-in-JS (pas de Tailwind) et ne touchant à rien d'autre que la mise
 * en forme visuelle du contenu qu'il enveloppe.
 */
export default function BoxReveal({
  children,
  width = "fit-content",
  boxColor = "#2563EB",
  duration = 0.5,
  className,
}) {
  const mainControls = useAnimation();
  const slideControls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      slideControls.start("visible");
      mainControls.start("visible");
    }
  }, [isInView, mainControls, slideControls]);

  return (
    <div ref={ref} style={{ position: "relative", width, overflow: "hidden" }} className={className}>
      <motion.div
        variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
        initial="hidden"
        animate={mainControls}
        transition={{ duration, delay: 0.15 }}
      >
        {children}
      </motion.div>
      <motion.div
        variants={{ hidden: { left: 0 }, visible: { left: "100%" } }}
        initial="hidden"
        animate={slideControls}
        transition={{ duration, ease: "easeIn" }}
        style={{
          position:      "absolute",
          top: 2, bottom: 2, left: 0, right: 0,
          zIndex:        1,
          background:    boxColor,
          borderRadius:  4,
        }}
      />
    </div>
  );
}
