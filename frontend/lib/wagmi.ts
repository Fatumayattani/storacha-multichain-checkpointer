import { http, createConfig } from "wagmi";
import { baseSepolia, avalancheFuji, supportedChains } from "./chains";
import { injected, metaMask, walletConnect } from "wagmi/connectors";

// WalletConnect project ID (you'll need to get this from WalletConnect)
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id";

export const config = createConfig({
  chains: supportedChains,
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId,
      metadata: {
        name: "Storacha Multichain Checkpointer",
        description:
          "A decentralized checkpointing system for Storacha content",
        url: "https://storacha-checkpointer.vercel.app", // Update with your domain
        icons: ["https://storacha-checkpointer.vercel.app/favicon.ico"],
      },
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [avalancheFuji.id]: http(),
  },
});
