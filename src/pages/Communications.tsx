import { useSearchParams } from "react-router-dom";
import { InboxView } from "@/components/communications/InboxView";

const Communications = () => {
  const [searchParams] = useSearchParams();
  const targetPhone = searchParams.get('phone');
  const targetLeadId = searchParams.get('leadId');
  const targetOwnerId = searchParams.get('ownerId');
  const targetContactName = searchParams.get('name');

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] -mx-4 md:mx-0 -mt-4 md:mt-0">
      <InboxView 
        initialTargetPhone={targetPhone}
        initialTargetLeadId={targetLeadId}
        initialTargetOwnerId={targetOwnerId}
        initialTargetName={targetContactName}
      />
    </div>
  );
};

export default Communications;
