import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templateId } = await req.json();

    if (!templateId) {
      return new Response(
        JSON.stringify({ success: false, error: "Template ID is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get template file path
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("file_path, name")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ success: false, error: "Template not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // The file_path might be a full URL or a relative path
    let fileData: Blob;
    
    if (template.file_path.startsWith("http")) {
      // It's a full URL, fetch directly
      console.log("Fetching from URL:", template.file_path);
      const response = await fetch(template.file_path);
      if (!response.ok) {
        console.error("Fetch error:", response.status, response.statusText);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch document: ${response.statusText}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      fileData = await response.blob();
    } else {
      // It's a relative path, download from storage
      // Determine the bucket - templates are in signed-documents bucket
      const bucketName = template.file_path.includes("templates/") ? "signed-documents" : "documents";
      console.log("Downloading from bucket:", bucketName, "path:", template.file_path);
      
      const { data, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(template.file_path);

      if (downloadError || !data) {
        console.error("Download error:", downloadError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to download document" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      fileData = data;
    }

    const fileName = template.file_path.toLowerCase();
    let textContent = "";

    if (fileName.endsWith(".docx")) {
      // Parse DOCX file
      textContent = await extractDocxText(fileData);
    } else if (fileName.endsWith(".txt")) {
      // Plain text file
      textContent = await fileData.text();
    } else if (fileName.endsWith(".pdf")) {
      // For PDF, we'll return a message that PDF editing isn't supported inline
      textContent = "[PDF documents cannot be edited as raw text. The document will be used as-is for signing.]";
    } else {
      textContent = "[Unsupported document format for text extraction]";
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: textContent,
        templateName: template.name 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error extracting document text:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function extractDocxText(blob: Blob): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // DOCX files are ZIP archives containing XML files
    // We need to extract document.xml from the archive
    
    // Simple ZIP extraction for DOCX
    const zipData = await unzip(uint8Array);
    
    // Look for word/document.xml
    const documentXml = zipData["word/document.xml"];
    if (!documentXml) {
      return "[Could not find document content in DOCX file]";
    }

    // Parse XML and extract text
    const text = extractTextFromXml(new TextDecoder().decode(documentXml));
    return text;
  } catch (error: unknown) {
    console.error("Error parsing DOCX:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return "[Error parsing DOCX file: " + errorMessage + "]";
  }
}

// Simple ZIP decompression for DOCX files
async function unzip(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  
  let offset = 0;
  while (offset < data.length - 4) {
    // Look for local file header signature (0x04034b50)
    if (data[offset] === 0x50 && data[offset + 1] === 0x4b && 
        data[offset + 2] === 0x03 && data[offset + 3] === 0x04) {
      
      const view = new DataView(data.buffer, data.byteOffset + offset);
      const compressionMethod = view.getUint16(8, true);
      const compressedSize = view.getUint32(18, true);
      const uncompressedSize = view.getUint32(22, true);
      const fileNameLength = view.getUint16(26, true);
      const extraFieldLength = view.getUint16(28, true);
      
      const fileName = new TextDecoder().decode(
        data.slice(offset + 30, offset + 30 + fileNameLength)
      );
      
      const dataStart = offset + 30 + fileNameLength + extraFieldLength;
      const compressedData = data.slice(dataStart, dataStart + compressedSize);
      
      if (compressionMethod === 0) {
        // Stored (no compression)
        files[fileName] = compressedData;
      } else if (compressionMethod === 8) {
        // Deflate compression
        try {
          const decompressed = await decompress(compressedData);
          files[fileName] = decompressed;
        } catch (e) {
          console.error(`Failed to decompress ${fileName}:`, e);
        }
      }
      
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  
  return files;
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
  // Use DecompressionStream for deflate
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  // Create a proper ArrayBuffer copy to avoid SharedArrayBuffer issues
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  writer.write(new Uint8Array(buffer));
  writer.close();
  
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }
  
  return result;
}

function extractTextFromXml(xml: string): string {
  // Extract text from Word XML
  // Text content is typically in <w:t> tags
  const textParts: string[] = [];
  
  // Match paragraphs
  const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
  let paragraphMatch;
  
  while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
    const paragraphContent = paragraphMatch[1];
    
    // Extract text from <w:t> tags within this paragraph
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let textMatch;
    let paragraphText = "";
    
    while ((textMatch = textRegex.exec(paragraphContent)) !== null) {
      paragraphText += textMatch[1];
    }
    
    if (paragraphText.trim()) {
      textParts.push(paragraphText);
    } else {
      // Empty paragraph = line break
      textParts.push("");
    }
  }
  
  return textParts.join("\n");
}