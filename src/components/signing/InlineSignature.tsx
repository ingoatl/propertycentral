import { useRef, useState } from "react";
import ReactSignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check, X } from "lucide-react";

interface InlineSignatureProps {
  onAdopt: (signatureData: string) => void;
  onCancel: () => void;
}

export function InlineSignature({ onAdopt, onCancel }: InlineSignatureProps) {
  const sigCanvasRef = useRef<ReactSignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    setIsEmpty(true);
  };

  const handleEnd = () => {
    if (sigCanvasRef.current) {
      setIsEmpty(sigCanvasRef.current.isEmpty());
    }
  };

  const handleAdopt = () => {
    if (sigCanvasRef.current && !isEmpty) {
      const dataUrl = sigCanvasRef.current.toDataURL("image/png");
      onAdopt(dataUrl);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-2xl border-2 border-[#2196f3] p-3 min-w-[280px] max-w-[320px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-[#333]">Draw Your Signature</h3>
        <button 
          onClick={onCancel}
          className="text-[#999] hover:text-[#666] p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="relative border-2 border-dashed border-[#ddd] rounded bg-[#fafafa] overflow-hidden">
        <ReactSignatureCanvas
          ref={sigCanvasRef}
          penColor="#1a1a2e"
          canvasProps={{
            className: "w-full",
            style: { width: "100%", height: "80px" },
          }}
          onEnd={handleEnd}
        />
        
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[#bbb] text-sm">Sign here</p>
          </div>
        )}
        
        {/* Signature line */}
        <div className="absolute bottom-4 left-3 right-3 border-b border-[#ccc]" />
      </div>

      <div className="flex justify-between items-center gap-2 mt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty}
          className="text-[#666] hover:text-[#333] text-xs h-8"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Clear
        </Button>
        
        <Button
          type="button"
          size="sm"
          onClick={handleAdopt}
          disabled={isEmpty}
          className="bg-[#fae052] text-[#1a1a2e] hover:bg-[#f5d93a] font-semibold text-xs h-8 px-4 disabled:opacity-40"
        >
          <Check className="h-3 w-3 mr-1" />
          Adopt Signature
        </Button>
      </div>
    </div>
  );
}

export default InlineSignature;
