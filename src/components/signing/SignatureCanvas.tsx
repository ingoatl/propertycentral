import { useRef, useState } from "react";
import ReactSignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, RotateCcw } from "lucide-react";

interface SignatureCanvasProps {
  onSignatureChange: (data: string | null) => void;
}

const SignatureCanvas = ({ onSignatureChange }: SignatureCanvasProps) => {
  const sigCanvasRef = useRef<ReactSignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    setIsEmpty(true);
    onSignatureChange(null);
  };

  const handleEnd = () => {
    if (sigCanvasRef.current) {
      const empty = sigCanvasRef.current.isEmpty();
      setIsEmpty(empty);
      
      if (!empty) {
        const dataUrl = sigCanvasRef.current.toDataURL("image/png");
        onSignatureChange(dataUrl);
      } else {
        onSignatureChange(null);
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden">
        <ReactSignatureCanvas
          ref={sigCanvasRef}
          penColor="black"
          canvasProps={{
            className: "w-full h-32",
            style: { width: "100%", height: "128px" },
          }}
          onEnd={handleEnd}
        />
        
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">Draw your signature here</p>
          </div>
        )}
        
        {/* Signature line */}
        <div className="absolute bottom-4 left-4 right-4 border-b border-gray-300" />
      </div>

      <div className="flex justify-between items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty}
          className="text-gray-500 hover:text-gray-700"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Clear
        </Button>
        
        <span className={`text-xs ${isEmpty ? "text-gray-400" : "text-emerald-600"}`}>
          {isEmpty ? "No signature" : "✓ Signature captured"}
        </span>
      </div>
    </div>
  );
};

export default SignatureCanvas;
