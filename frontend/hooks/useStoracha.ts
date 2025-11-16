import { useState, useCallback } from "react";
import { create, type Client } from "@storacha/client";

export interface UploadResult {
  cid: string;
  size: number;
  name: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export function useStoracha() {
  const [client, setClient] = useState<Client | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const initializeClient = useCallback(async () => {
    try {
      setError(null);
      console.log("🔄 Creating Storacha client...");
      const storachaClient = await create();

      // Check if there's already a current space
      let currentSpace = storachaClient.currentSpace();

      if (!currentSpace) {
        console.log("🔄 No current space found, need to set up account...");

        // For testing, we'll prompt user to login (in a real app, you'd handle this in UI)
        console.log(
          "⚠️  Space setup required. This might require email login..."
        );

        try {
          // Try to create space with account (this may trigger login flow)
          console.log("🔄 Creating space with account setup...");
          const space = await storachaClient.createSpace("checkpointer-space");
          console.log("✅ Space created:", space.did());
          currentSpace = storachaClient.currentSpace();
        } catch (spaceError) {
          console.log(
            "⚠️  Space creation requires account. Error:",
            spaceError
          );

          // Provide helpful error message
          const helpMessage = `
🔧 Storacha Setup Required:

1. The Storacha client needs an account to create spaces
2. This typically requires email verification
3. For testing, you might need to:
   - Create account manually at https://console.storacha.network
   - Use the CLI: npm install -g @storacha/cli && storacha login
   - Or handle the login flow in your app

For MVP testing, we can:
- Skip upload tests and focus on CID verification
- Or set up proper Storacha account first`;

          throw new Error(helpMessage);
        }
      }

      console.log("✅ Storacha client ready with space:", currentSpace?.did());
      setClient(storachaClient);
      return storachaClient;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to initialize Storacha client";
      console.error("❌ Storacha initialization error:", err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult> => {
      if (!client) {
        throw new Error("Storacha client not initialized");
      }

      setIsUploading(true);
      setError(null);
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });

      try {
        // Check if we have a current space
        const currentSpace = client.currentSpace();
        if (!currentSpace) {
          throw new Error(
            "No current space available. Try re-initializing the client."
          );
        }

        console.log(
          "🔄 Uploading file:",
          file.name,
          "to space:",
          currentSpace.did()
        );

        // Use correct Storacha client API
        const cid = await client.uploadFile(file);

        console.log("✅ File uploaded successfully! CID:", cid.toString());

        // Update progress to 100%
        setUploadProgress({
          loaded: file.size,
          total: file.size,
          percentage: 100,
        });

        // Return the result
        return {
          cid: cid.toString(), // CID is already proper format
          size: file.size,
          name: file.name,
        };
      } catch (err) {
        console.error("❌ Upload error details:", err);

        // Provide more helpful error messages
        let errorMessage = "Upload failed";
        if (err instanceof Error) {
          if (err.message.includes("space/blob/add")) {
            errorMessage = `Upload failed: ${err.message}\n\n🔧 This usually means:\n- Account not properly set up\n- Space needs billing/payment plan\n- Need to login with email first\n\nTry setting up Storacha account at https://console.storacha.network`;
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsUploading(false);
      }
    },
    [client]
  );

  const uploadMultipleFiles = useCallback(
    async (files: FileList | File[]): Promise<UploadResult[]> => {
      if (!client) {
        throw new Error("Storacha client not initialized");
      }

      const fileArray = Array.from(files);
      const results: UploadResult[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        try {
          const result = await uploadFile(file);
          results.push(result);
        } catch (err) {
          console.error(`Failed to upload file ${file.name}:`, err);
          // Continue with other files even if one fails
        }
      }

      return results;
    },
    [client, uploadFile]
  );

  return {
    client,
    isUploading,
    uploadProgress,
    error,
    initializeClient,
    uploadFile,
    uploadMultipleFiles,
    clearError: () => setError(null),
  };
}
