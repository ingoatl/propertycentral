import { supabase } from "@/integrations/supabase/client";

export const uploadLogoToSupabase = async () => {
  try {
    console.log("Fetching logo from public folder...");
    
    // Fetch the logo from public folder
    const response = await fetch("/peachhaus-logo.png");
    if (!response.ok) {
      throw new Error("Failed to fetch logo from public folder");
    }
    
    const blob = await response.blob();
    
    console.log("Uploading logo to Supabase storage...");
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload('peachhaus-logo.png', blob, {
        contentType: 'image/png',
        upsert: true, // Overwrite if exists
      });
    
    if (error) throw error;
    
    console.log("Logo uploaded successfully:", data);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('property-images')
      .getPublicUrl('peachhaus-logo.png');
    
    console.log("Logo public URL:", urlData.publicUrl);
    
    return { success: true, url: urlData.publicUrl };
  } catch (error: any) {
    console.error("Error uploading logo:", error);
    return { success: false, error: error.message };
  }
};
