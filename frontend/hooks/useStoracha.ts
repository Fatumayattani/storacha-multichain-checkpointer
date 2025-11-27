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

  const initializeClient = useCallback(async (email?: string) => {
    try {
      setError(null);
      console.log("🔄 Creating Storacha client...");
      const storachaClient = await create();

      // Check all available spaces
      const allSpaces = storachaClient.spaces();
      console.log("📋 All available spaces:", allSpaces.map(s => s.did()));

      // Check for accounts (safely)
      try {
        const accounts = storachaClient.accounts();
        if (Array.isArray(accounts)) {
          console.log("👤 Available accounts:", accounts.map(a => a.did()));
        } else {
          console.log("👤 Accounts:", accounts);
        }
      } catch (accountError) {
        console.log("⚠️ Could not list accounts:", accountError);
      }

      // If email is provided, try login flow
      if (email) {
        console.log(`🔄 Attempting login with email: ${email}`);
        try {
          // Validate email format
          if (!email.includes('@')) {
            throw new Error('Invalid email format');
          }
          // Try to login - this might use cached credentials
          const account = await storachaClient.login(email as `${string}@${string}`);
          console.log("✅ Login initiated for:", email);

          // Check if we need to wait for verification
          try {
            console.log("⏳ Checking payment plan...");
            await account.plan.wait();
            console.log("✅ Payment plan confirmed");
          } catch (planError) {
            console.warn("⚠️ Could not verify plan immediately:", planError);
          }
        } catch (loginError) {
          console.warn("⚠️ Login flow issue:", loginError);
          // Continue anyway - might already be logged in
        }
      }

      // Re-check spaces after login attempt
      const spacesAfterLogin = storachaClient.spaces();
      console.log("📋 Spaces after login:", spacesAfterLogin.map(s => s.did()));

      // Look for the provisioned space
      const PROVISIONED_SPACE_DID = "did:key:z6MkvDg2cshZhnktNyephg6Dg1Cvf2qJGdinq5ELgTnpm6vB";
      const provisionedSpace = spacesAfterLogin.find(s => s.did() === PROVISIONED_SPACE_DID);

      if (provisionedSpace) {
        console.log("✅ Found your provisioned space!");
        await storachaClient.setCurrentSpace(provisionedSpace.did());
        console.log("✅ Set current space to:", provisionedSpace.did());
        setClient(storachaClient);
        return storachaClient;
      }

      // Get current space
      let currentSpace = storachaClient.currentSpace();

      if (!currentSpace) {
        throw new Error(
          "⚠️ No space available!\n\n" +
          "Available spaces: " + spacesAfterLogin.map(s => s.did()).join(", ") + "\n\n" +
          "Expected provisioned space: " + PROVISIONED_SPACE_DID + "\n\n" +
          "Please ensure you're logged in at console.storacha.network"
        );
      }

      const spaceDid = currentSpace.did();
      console.log("📍 Current space:", spaceDid);

      // Warn if not using the provisioned space
      if (spaceDid !== PROVISIONED_SPACE_DID) {
        console.warn("⚠️ Not using your provisioned space!");
        console.warn("Current:", spaceDid);
        console.warn("Expected:", PROVISIONED_SPACE_DID);
        throw new Error(
          "⚠️ Using wrong space!\n\n" +
          "Current space: " + spaceDid + "\n" +
          "Your provisioned space: " + PROVISIONED_SPACE_DID + "\n\n" +
          "This space may not have billing attached. Uploads might fail."
        );
      }

      console.log("✅ Storacha client ready with provisioned space:", currentSpace.did());
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

        // Log all available spaces for debugging
        const spaces = client.spaces();
        console.log("📋 Available spaces:", spaces.map(s => s.did()));

        // Check if space has account
        console.log("🔍 Checking space details...");

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

  const addExistingSpace = useCallback(
    async (delegationProof: any) => {
      try {
        setError(null);
        if (!client) {
          throw new Error("Client not initialized. Call initializeClient first.");
        }

        console.log("🔄 Adding existing space from delegation...");
        const sharedSpace = await client.addSpace(delegationProof);

        console.log("✅ Space added successfully!");
        console.log(`📍 Space DID: ${sharedSpace.did()}`);

        // Set as current space
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
