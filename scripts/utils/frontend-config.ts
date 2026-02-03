import * as fs from "fs";
import * as path from "path";

export const ENV_VARS: Record<string, Record<number, string>> = {
  PUBLISHER: {
    84532: "NEXT_PUBLIC_BASE_SEPOLIA_PUBLISHER_ADDRESS",
  },
  RECEIVER: {
    43113: "NEXT_PUBLIC_FUJI_RECEIVER_ADDRESS",
  },
};

export async function updateFrontendConfig(
  contractType: "PUBLISHER" | "RECEIVER",
  chainId: number,
  address: string
) {
  const envVarName = ENV_VARS[contractType]?.[chainId];

  if (!envVarName) {
    console.warn(
      `⚠️ No frontend environment variable mapping found for ${contractType} on chain ${chainId}`
    );
    return;
  }

  const frontendPath = path.join(process.cwd(), "frontend");
  const envFilePath = path.join(frontendPath, ".env.local");

  let content = "";
  if (fs.existsSync(envFilePath)) {
    content = fs.readFileSync(envFilePath, "utf-8");
  } else {
    content =
      "# Storacha Multichain Checkpointer - Frontend Environment Variables\n";
  }

  const lines = content.split("\n");
  let found = false;
  const newLines = lines.map((line) => {
    if (line.startsWith(`${envVarName}=`)) {
      found = true;
      return `${envVarName}=${address}`;
    }
    return line;
  });

  if (!found) {
    if (newLines.length > 0 && newLines[newLines.length - 1] !== "") {
      newLines.push("");
    }
    newLines.push(`${envVarName}=${address}`);
  }

  const finalContent = newLines.join("\n").replace(/\n+$/, "") + "\n";

  fs.writeFileSync(envFilePath, finalContent, "utf-8");
  console.log(`✅ Updated frontend config: ${envVarName}=${address}`);
}
