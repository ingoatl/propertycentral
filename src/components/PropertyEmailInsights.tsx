import { EmailInsightsCard } from "./EmailInsightsCard";

interface PropertyEmailInsightsProps {
  propertyId: string;
}

export function PropertyEmailInsights({ propertyId }: PropertyEmailInsightsProps) {
  return <EmailInsightsCard propertyId={propertyId} showHeader={false} />;
}
