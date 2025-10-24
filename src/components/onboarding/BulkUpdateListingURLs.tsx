import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const LISTING_DATA = [
  {
    address: "169 Willow Stream Ct",
    airbnb: "https://www.airbnb.com/rooms/37773037",
    vrbo: "https://www.vrbo.com/en-au/holiday-rental/p1738420vb"
  },
  {
    address: "3155 Duvall Pl",
    airbnb: "https://www.airbnb.com/rooms/50104697",
    vrbo: "https://www.vrbo.com/en-au/holiday-rental/p2334877vb"
  },
  {
    address: "4241 Osburn Ct",
    airbnb: "https://www.airbnb.com/rooms/894861867040611368",
    vrbo: "https://www.vrbo.com/3432335"
  },
  {
    address: "5360 Durham Ridge Ct",
    airbnb: "https://www.airbnb.com/rooms/707411807049153074",
    vrbo: "https://www.vrbo.com/3004492"
  },
  {
    address: "3069 Rita Way",
    airbnb: "https://www.airbnb.com/rooms/39178226",
    vrbo: "https://www.vrbo.com/2708824"
  },
  {
    address: "2580 Old Roswell Rd",
    airbnb: "https://www.airbnb.com/rooms/581294085844536405",
    vrbo: "https://www.vrbo.com/2708824"
  },
  {
    address: "5198 Laurel Bridge Dr SE",
    airbnb: "https://www.airbnb.com/rooms/43339882",
    vrbo: "https://www.vrbo.com/en-au/holiday-rental/p1976841vb"
  },
  {
    address: "184 Woodland Ln SW",
    airbnb: "https://www.airbnb.com/rooms/1324567699805540986",
    vrbo: "https://www.vrbo.com/4722192"
  }
];

export const BulkUpdateListingURLs = () => {
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    try {
      setLoading(true);
      let updatedCount = 0;
      let errorCount = 0;

      for (const property of LISTING_DATA) {
        console.log(`\n=== Processing ${property.address} ===`);

        // Extract key parts of address for flexible matching
        const addressParts = property.address.split(' ');
        const streetNumber = addressParts[0];
        const streetName = addressParts.slice(1).join(' ').toLowerCase();

        // Find the property by address with flexible matching
        const { data: properties, error: propError } = await supabase
          .from("properties")
          .select("id, address")
          .or(`address.ilike.%${streetNumber}%,address.ilike.%${streetName}%`);

        if (propError) {
          console.error(`Error finding property ${property.address}:`, propError);
          errorCount++;
          continue;
        }

        // Find best match
        const matchedProperty = properties?.find(p => 
          p.address.includes(streetNumber) && 
          streetName.split(' ').some(word => p.address.toLowerCase().includes(word))
        );

        if (!matchedProperty) {
          console.warn(`Property not found: ${property.address}`);
          console.log(`Searched for: ${streetNumber} and ${streetName}`);
          errorCount++;
          continue;
        }

        const propertyId = matchedProperty.id;
        console.log(`✓ Found property: ${matchedProperty.address} (ID: ${propertyId})`);

        // Find the onboarding project for this property
        const { data: projects, error: projectError } = await supabase
          .from("onboarding_projects")
          .select("id")
          .eq("property_id", propertyId)
          .limit(1);

        if (projectError) {
          console.error(`Error finding project for ${property.address}:`, projectError);
          errorCount++;
          continue;
        }

        if (!projects || projects.length === 0) {
          console.warn(`No onboarding project found for ${property.address}`);
          errorCount++;
          continue;
        }

        const projectId = projects[0].id;
        console.log(`✓ Found project ID: ${projectId}`);

        // Find and update Airbnb URL task
        const { data: airbnbTasks } = await supabase
          .from("onboarding_tasks")
          .select("id, title, field_value, status")
          .eq("project_id", projectId)
          .or("title.ilike.%Airbnb%URL%,title.ilike.%Airbnb%Link%");

        console.log(`Found ${airbnbTasks?.length || 0} Airbnb URL tasks`);
        
        if (airbnbTasks && airbnbTasks.length > 0) {
          const airbnbTask = airbnbTasks[0];
          console.log(`Airbnb task: "${airbnbTask.title}" (current: ${airbnbTask.field_value || 'empty'})`);
          
          const { error: airbnbError } = await supabase
            .from("onboarding_tasks")
            .update({
              field_value: property.airbnb,
              status: "completed",
              completed_date: new Date().toISOString(),
            })
            .eq("id", airbnbTask.id);

          if (airbnbError) {
            console.error(`✗ Error updating Airbnb task:`, airbnbError);
            errorCount++;
          } else {
            console.log(`✓ Updated Airbnb URL`);
            updatedCount++;
          }
        } else {
          console.warn(`✗ No Airbnb URL task found for ${property.address}`);
        }

        // Find and update VRBO URL task
        const { data: vrboTasks } = await supabase
          .from("onboarding_tasks")
          .select("id, title, field_value, status")
          .eq("project_id", projectId)
          .or("title.ilike.%VRBO%URL%,title.ilike.%VRBO%Link%");

        console.log(`Found ${vrboTasks?.length || 0} VRBO URL tasks`);

        if (vrboTasks && vrboTasks.length > 0) {
          const vrboTask = vrboTasks[0];
          console.log(`VRBO task: "${vrboTask.title}" (current: ${vrboTask.field_value || 'empty'})`);
          
          const { error: vrboError } = await supabase
            .from("onboarding_tasks")
            .update({
              field_value: property.vrbo,
              status: "completed",
              completed_date: new Date().toISOString(),
            })
            .eq("id", vrboTask.id);

          if (vrboError) {
            console.error(`✗ Error updating VRBO task:`, vrboError);
            errorCount++;
          } else {
            console.log(`✓ Updated VRBO URL`);
            updatedCount++;
          }
        } else {
          console.warn(`✗ No VRBO URL task found for ${property.address}`);
        }
      }

      if (updatedCount > 0) {
        toast.success(`Successfully updated ${updatedCount} listing URLs!`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.warning("No tasks were updated. Check console for details.");
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} errors occurred during update`);
      }
    } catch (error: any) {
      console.error("Error updating listing URLs:", error);
      toast.error("Failed to update listing URLs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Link className="h-4 w-4" />
          Bulk Update Listing URLs
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Listing URLs?</AlertDialogTitle>
          <AlertDialogDescription>
            This will update Airbnb and VRBO listing URLs for {LISTING_DATA.length} properties
            and mark those tasks as completed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpdate} disabled={loading}>
            {loading ? "Updating..." : "Update URLs"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
