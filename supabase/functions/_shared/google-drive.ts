// Google Drive upload utilities for agreement backup

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  webContentLink: string;
}

/**
 * Upload a file to Google Drive
 */
export async function uploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  fileContent: Uint8Array,
  mimeType: string,
  folderId?: string
): Promise<DriveUploadResult> {
  // Create file metadata
  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: mimeType,
  };

  // Add to specific folder if provided
  if (folderId) {
    metadata.parents = [folderId];
  }

  // Create multipart upload body
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";

  // Convert Uint8Array to base64 safely (chunk to avoid stack overflow)
  function uint8ArrayToBase64(bytes: Uint8Array): string {
    const chunkSize = 32768;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  const base64Content = uint8ArrayToBase64(fileContent);

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: " +
    mimeType +
    "\r\n" +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    base64Content +
    closeDelim;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Google Drive upload error:", errorData);
    throw new Error(
      `Failed to upload to Google Drive: ${errorData.error?.message || response.statusText}`
    );
  }

  const result = await response.json();
  console.log("Google Drive upload successful:", result.id);

  return {
    fileId: result.id,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    webContentLink: result.webContentLink || "",
  };
}

/**
 * Get folder ID by name (creates if doesn't exist)
 */
export async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  // Search for existing folder
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (searchResponse.ok) {
    const searchResult = await searchResponse.json();
    if (searchResult.files && searchResult.files.length > 0) {
      return searchResult.files[0].id;
    }
  }

  // Create new folder
  const metadata: Record<string, any> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const createResponse = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!createResponse.ok) {
    throw new Error(`Failed to create folder: ${createResponse.statusText}`);
  }

  const createResult = await createResponse.json();
  return createResult.id;
}
