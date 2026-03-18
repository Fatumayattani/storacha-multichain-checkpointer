/**
 * @title ElizaOS Adapter Example
 * @notice Demonstrates how an ElizaOS agent would use the Storacha attestation plugin.
 *
 * Usage: npx tsx scripts/elizaos-example.ts
 */
import { storachaAttestationPlugin } from "../elizaos-adapter/index.js";
import type { IAgentRuntime, Message } from "../elizaos-adapter/types.js";

async function main() {
  console.log("--- ElizaOS Adapter Example ---\n");

  // 1. Show plugin info
  const plugin = storachaAttestationPlugin;
  console.log("Plugin:", plugin.name);
  console.log("Description:", plugin.description);
  console.log("Actions:", plugin.actions?.map((a) => a.name).join(", "));

  // 2. Simulate an agent runtime with settings
  const runtime: IAgentRuntime = {
    getSetting(key: string) {
      const settings: Record<string, string> = {
        ATTESTATION_CREATOR_ADDRESS:
          "0x1234567890123456789012345678901234567890",
      };
      return settings[key];
    },
  };

  // 3. Simulate an incoming message with a CID
  const message: Message = {
    content: {
      text: "Attest this dataset CID",
      cid: "bafybeidataattestationexamplecidbafybeidataattestation",
    },
  };

  const action = plugin.actions![0];

  // 4. Validate
  const isValid = await action.validate(runtime, message);
  console.log("\nValidation passed:", isValid);

  if (!isValid) {
    console.log("Message does not contain a valid CID. Skipping.");
    return;
  }

  // 5. Handle
  const result = await action.handler(
    runtime,
    message,
    undefined,
    undefined,
    (response) => {
      console.log("\n[Agent Callback]", response.text);
    }
  );

  console.log("\nAction result:", JSON.stringify(result, null, 2));
  console.log("\n--- Example Complete ---");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
