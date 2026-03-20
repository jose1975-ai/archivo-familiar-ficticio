import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../types';

interface PolaroidProps {
  src: string;
  caption?: string;
  className?: string;
  rotation?: number;
  onClick?: () => void;
}

export const Polaroid: React.FC<PolaroidProps> = ({ src, caption, className, rotation = 0, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: rotation - 5 }}
      animate={{ opacity: 1, y: 0, rotate: rotation }}
      whileHover={{ scale: 1.02, rotate: 0, zIndex: 10 }}
      onClick={onClick}
      className={cn(
        "bg-white p-4 pb-12 polaroid-shadow border border-gray-200 inline-block cursor-pointer",
        className
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100 mb-4">
        <img 
          src={src} 
          alt={caption || "Archive photo"} 
          className="object-cover w-full h-full grayscale hover:grayscale-0 transition-all duration-700"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/broken/400/400?grayscale';
          }}
        />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-orange-900/5 to-transparent mix-blend-overlay" />
      </div>
      {caption && (
        <p className="typewriter-text text-center text-sm text-vintage-ink/70 mt-2">
          {caption}
        </p>
      )}
    </motion.div>
  );
};
