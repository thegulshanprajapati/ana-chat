/**
 * CoupleModeController
 * ─────────────────────
 * Detects if current call peer is the linked partner with couple mode
 * enabled. Renders a subtle couple badge and exports `isCouple` for
 * sibling components (FloatingReactionLayer, etc.).
 *
 * Props
 * ─────
 * peerUserId       number | null
 * myPartnerId      number | null
 * coupleModeOn     boolean
 * myName           string
 * peerName         string
 */
import { motion } from "framer-motion";
import { Heart } from "lucide-react";

export default function CoupleModeController({
  peerUserId,
  myPartnerId,
  coupleModeOn,
  myName,
  peerName,
}) {
  const isCouple =
    coupleModeOn &&
    myPartnerId != null &&
    peerUserId != null &&
    Number(peerUserId) === Number(myPartnerId);

  if (!isCouple) return null;

  const label = `${myName || "You"} & ${peerName || "Partner"}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -8 }}
      transition={{ type: "spring", damping: 20, stiffness: 280 }}
      className="
        flex items-center gap-1.5 px-3 py-1 rounded-full
        bg-rose-600/20 border border-rose-500/30 backdrop-blur-md
        shadow-[0_4px_20px_rgba(239,68,68,0.25)]
      "
      aria-label={`Couple mode active: ${label}`}
    >
      <Heart size={12} className="text-rose-400 fill-rose-400 shrink-0 animate-pulse" />
      <span className="text-[11px] font-semibold text-rose-300 truncate max-w-[180px]">
        {label}
      </span>
    </motion.div>
  );
}

/** Pure helper — same logic as the component, usable outside React */
export function checkIsCouple(peerUserId, myPartnerId, coupleModeOn) {
  return (
    coupleModeOn === true &&
    myPartnerId != null &&
    peerUserId  != null &&
    Number(peerUserId) === Number(myPartnerId)
  );
}
