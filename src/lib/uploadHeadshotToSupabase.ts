import { supabase } from "@/integrations/supabase/client";

export const uploadImageToSupabase = async (imagePath: string, fileName: string) => {
  try {
    console.log(`Fetching ${fileName} from public folder...`);
    
    // Fetch the image from the public folder
    const response = await fetch(imagePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log(`${fileName} fetched, size:`, blob.size);
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (error) {
      throw error;
    }
    
    console.log(`${fileName} uploaded successfully:`, data);
    
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
    console.error(`Error uploading ${fileName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const uploadHeadshotToSupabase = async () => {
  return uploadImageToSupabase('/images/ingo-headshot.png', 'ingo-headshot.png');
};

export const uploadSignatureToSupabase = async () => {
  return uploadImageToSupabase('/images/ingo-signature.png', 'ingo-signature.png');
};

// Auto-run if this module is imported
if (typeof window !== 'undefined') {
  const storageBaseUrl = 'https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images';
  
  // Check and upload headshot
  fetch(`${storageBaseUrl}/ingo-headshot.png`)
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

  // Check and upload signature
  fetch(`${storageBaseUrl}/ingo-signature.png`)
    .then(res => {
      if (!res.ok) {
        console.log("Signature not found in storage, uploading...");
        uploadSignatureToSupabase();
      } else {
        console.log("Signature already exists in storage");
      }
    })
    .catch(() => {
      console.log("Error checking signature, attempting upload...");
      uploadSignatureToSupabase();
    });
}
