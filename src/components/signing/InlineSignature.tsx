import { useRef, useState } from "react";
import ReactSignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check } from "lucide-react";

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
    <div className="bg-white rounded-lg shadow-2xl border-2 border-blue-500 p-4 space-y-3 min-w-[300px]">
      <div className="text-center">
        <h3 className="font-semibold text-sm text-gray-900">Draw Your Signature</h3>
        <p className="text-xs text-gray-500">Sign in the box below</p>
      </div>
      
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
        <ReactSignatureCanvas
          ref={sigCanvasRef}
          penColor="black"
          canvasProps={{
            className: "w-full",
            style: { width: "100%", height: "100px" },
          }}
          onEnd={handleEnd}
        />
        
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Sign here</p>
          </div>
        )}
        
        {/* Signature line */}
        <div className="absolute bottom-3 left-4 right-4 border-b border-gray-300" />
      </div>

      <div className="flex justify-between items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty}
          className="text-gray-500 hover:text-gray-700"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Clear
        </Button>
        
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAdopt}
            disabled={isEmpty}
            className="bg-[#fae052] text-black hover:bg-[#f5d93a]"
          >
            <Check className="h-3 w-3 mr-1" />
            Adopt & Sign
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InlineSignature;
