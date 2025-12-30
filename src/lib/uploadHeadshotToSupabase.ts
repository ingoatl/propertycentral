import { supabase } from "@/integrations/supabase/client";

export const uploadHeadshotToSupabase = async () => {
  try {
    console.log("Fetching Ingo's headshot from public folder...");
    
    // Fetch the image from the public folder
    const response = await fetch('/images/ingo-headshot.png');
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log("Headshot fetched, size:", blob.size);
    
    // Upload to Supabase storage
    const fileName = 'ingo-headshot.png';
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (error) {
      throw error;
    }
    
    console.log("Headshot uploaded successfully:", data);
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('property-images')
      .getPublicUrl(fileName);
    
    console.log("Public URL:", urlData.publicUrl);
    
    return {
      success: true,
      path: data.path,
      publicUrl: urlData.publicUrl
    };
  } catch (error) {
    console.error("Error uploading headshot:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Auto-run if this module is imported
if (typeof window !== 'undefined') {
  // Check if already uploaded by trying to fetch the image
  fetch('https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png')
    .then(res => {
      if (!res.ok) {
        console.log("Headshot not found in storage, uploading...");
        uploadHeadshotToSupabase();
      } else {
        console.log("Headshot already exists in storage");
      }
    })
    .catch(() => {
      console.log("Error checking headshot, attempting upload...");
      uploadHeadshotToSupabase();
    });
}
