import { motion } from "framer-motion";

interface TranscriptDisplayProps {
  partial: string;
  committed: string;
}

export function TranscriptDisplay({ partial, committed }: TranscriptDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full">
      {committed && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white text-sm mb-1"
        >
          {committed}
        </motion.p>
      )}
      {partial && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          className="text-gray-400 text-sm"
        >
          {partial}
          <span className="animate-pulse">|</span>
        </motion.p>
      )}
    </div>
  );
}
