import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DashboardQuickLinks } from "./DashboardQuickLinks";
import { useUserTeamRole } from "@/hooks/useUserTeamRole";
import { Users, DollarSign, Target } from "lucide-react";

export function RoleBasedQuickActions() {
  const { isOpsManager, isBookkeeper, isMarketingVA, isSales, isCleanerCoordinator, isLoading } = useUserTeamRole();

  // Show Ops button for Ops Manager or Cleaner Coordinator
  const showVendorsButton = isOpsManager || isCleanerCoordinator;
  
  // Show leads button for Marketing VA or Sales
  const showLeadsButton = isMarketingVA || isSales;

  return (
    <div className="flex items-center gap-2">
      {/* Quick Links dropdown - visible to all users */}
      <DashboardQuickLinks />

      {/* Role-specific action buttons */}
      {!isLoading && (
        <>
          {showVendorsButton && (
            <Link to="/vendors">
              <Button variant="default" size="sm" className="gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Open Vendors</span>
              </Button>
            </Link>
          )}

          {isBookkeeper && (
            <Link to="/monthly-charges">
              <Button variant="default" size="sm" className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Monthly Charges</span>
              </Button>
            </Link>
          )}

          {showLeadsButton && (
            <Link to="/leads-pipeline">
              <Button variant="default" size="sm" className="gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Leads Pipeline</span>
              </Button>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
