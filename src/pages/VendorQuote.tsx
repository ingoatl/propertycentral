import { useParams, useSearchParams } from "react-router-dom";
import { VendorQuoteForm } from "@/components/maintenance/VendorQuoteForm";

export default function VendorQuote() {
  const { requestId } = useParams<{ requestId: string }>();
  const [searchParams] = useSearchParams();
  const vendorToken = searchParams.get("token") || undefined;

  if (!requestId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Invalid quote request.</p>
      </div>
    );
  }

  return <VendorQuoteForm requestId={requestId} vendorToken={vendorToken} />;
}
