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

  // ✅ FIXED: delegated-space initialization only
  const initializeClient = useCallback(async (delegationProof: any) => {
    try {
      setError(null);
      console.log("🔄 Creating Storacha client...");
      const storachaClient = await create();

      console.log("🔄 Importing delegated space...");
      const space = await storachaClient.addSpace(delegationProof);

      console.log("✅ Delegated space imported:", space.did());

      await storachaClient.setCurrentSpace(space.did());
      console.log("✅ Set current space to:", space.did());

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

        const spaces = client.spaces();
        console.log(
          "📋 Available spaces:",
          spaces.map((s) => s.did())
        );

        const cid = await client.uploadFile(file);

        console.log("✅ File uploaded successfully! CID:", cid.toString());

        setUploadProgress({
          loaded: file.size,
          total: file.size,
          percentage: 100,
        });

        return {
          cid: cid.toString(),
          size: file.size,
          name: file.name,
        };
      } catch (err) {
        console.error("❌ Upload error details:", err);

        let errorMessage = "Upload failed";
        if (err instanceof Error) {
          if (err.message.includes("space/blob/add")) {
            errorMessage = `Upload failed: ${err.message}\n\n🔧 This usually means:\n- Account not properly set up\n- Space needs billing/payment plan\n\nEnsure the delegated space has an active plan.`;
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
        }
      }

      return results;
    },
    [client, uploadFile]
  );

  const addExistingSpace = useCallback(
    async (delegationProof: any) => {
      try {
        setError(null);
        if (!client) {
          throw new Error(
            "Client not initialized. Call initializeClient first."
          );
        }

        console.log("🔄 Adding existing space from delegation...");
        const sharedSpace = await client.addSpace(delegationProof);

        console.log("✅ Space added successfully!");
        console.log(`📍 Space DID: ${sharedSpace.did()}`);

        await client.setCurrentSpace(sharedSpace.did());
        console.log("✅ Set as current space");

        return sharedSpace;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to add space";
        console.error("❌ Add space error:", err);
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [client]
  );

  return {
    client,
    isUploading,
    uploadProgress,
    error,
    initializeClient,
    addExistingSpace,
    uploadFile,
    uploadMultipleFiles,
    clearError: () => setError(null),
  };
}
