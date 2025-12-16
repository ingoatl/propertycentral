import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoLightboxProps {
  isOpen: boolean;
  imageUrl: string | null;
  alt?: string;
  onClose: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  isOpen,
  imageUrl,
  alt = 'Photo',
  onClose
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
      >
        <X className="h-6 w-6 text-white" />
      </button>
      <img
        src={imageUrl}
        alt={alt}
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};
