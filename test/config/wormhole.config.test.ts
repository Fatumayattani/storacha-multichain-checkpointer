import { expect } from "chai";
import {
  WORMHOLE_CONFIG,
  WORMHOLE_CORE_ADDRESSES,
  CHAIN_METADATA,
  getWormholeCoreAddress,
  getChainMetadata,
  getChainConfig,
  isChainSupported,
} from "../../config/wormhole.config.js";
import { CHAIN_IDS } from "../../constants/chainIds.js";

describe("Wormhole Configuration", function () {
  describe("WORMHOLE_CONFIG", function () {
    it("should have correct Guardian RPC endpoint", function () {
      expect(WORMHOLE_CONFIG.guardianRPC).to.equal(
        "https://api.testnet.wormholescan.io"
      );
    });

    it("should have correct consistency level", function () {
      expect(WORMHOLE_CONFIG.consistencyLevel).to.equal(1);
    });
  });

  describe("WORMHOLE_CORE_ADDRESSES", function () {
    it("should have correct addresses for all chains", function () {
      expect(WORMHOLE_CORE_ADDRESSES[CHAIN_IDS.BASE_SEPOLIA_WORMHOLE]).to.equal(
        "0x79A1027a6A159502049F10906D333EC57E95F083"
      );
      expect(
        WORMHOLE_CORE_ADDRESSES[CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE]
      ).to.equal("0x7bbcE28e64B3F8b84d876Ab298393c38ad7aac4C");
      expect(
        WORMHOLE_CORE_ADDRESSES[CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE]
      ).to.equal("0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78");
    });
  });

  describe("CHAIN_METADATA", function () {
    it("should have correct metadata for all chains", function () {
      expect(
        CHAIN_METADATA[CHAIN_IDS.BASE_SEPOLIA_WORMHOLE].chainName
      ).to.equal("Base Sepolia");
      expect(
        CHAIN_METADATA[CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE].chainName
      ).to.equal("Avalanche Fuji");
      expect(
        CHAIN_METADATA[CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE].chainName
      ).to.equal("Ethereum Sepolia");
    });
  });

  describe("getWormholeCoreAddress", function () {
    it("should return correct address for Base Sepolia", function () {
      const address = getWormholeCoreAddress(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
      expect(address).to.equal("0x79A1027a6A159502049F10906D333EC57E95F083");
    });

    it("should return correct address for Avalanche Fuji", function () {
      const address = getWormholeCoreAddress(CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE);
      expect(address).to.equal("0x7bbcE28e64B3F8b84d876Ab298393c38ad7aac4C");
    });

    it("should return correct address for Ethereum Sepolia", function () {
      const address = getWormholeCoreAddress(
        CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE
      );
      expect(address).to.equal("0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78");
    });

    it("should throw for unsupported chain", function () {
      expect(() => getWormholeCoreAddress(999)).to.throw(
        "No Wormhole Core address for chain ID: 999"
      );
    });
  });

  describe("getChainMetadata", function () {
    it("should return metadata for Base Sepolia", function () {
      const metadata = getChainMetadata(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
      expect(metadata.chainName).to.equal("Base Sepolia");
      expect(metadata.explorerUrl).to.equal("https://sepolia.basescan.org");
    });

    it("should return metadata for Avalanche Fuji", function () {
      const metadata = getChainMetadata(CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE);
      expect(metadata.chainName).to.equal("Avalanche Fuji");
      expect(metadata.explorerUrl).to.equal("https://testnet.snowtrace.io");
    });

    it("should return metadata for Ethereum Sepolia", function () {
      const metadata = getChainMetadata(CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE);
      expect(metadata.chainName).to.equal("Ethereum Sepolia");
      expect(metadata.explorerUrl).to.equal("https://sepolia.etherscan.io");
    });

    it("should throw for unsupported chain", function () {
      expect(() => getChainMetadata(999)).to.throw(
        "No metadata for chain ID: 999"
      );
    });
  });

  describe("getChainConfig", function () {
    it("should return complete config for Base Sepolia", function () {
      const config = getChainConfig(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
      expect(config.wormholeCoreAddress).to.equal(
        "0x79A1027a6A159502049F10906D333EC57E95F083"
      );
      expect(config.chainName).to.equal("Base Sepolia");
      expect(config.explorerUrl).to.equal("https://sepolia.basescan.org");
    });

    it("should return complete config for Avalanche Fuji", function () {
      const config = getChainConfig(CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE);
      expect(config.wormholeCoreAddress).to.equal(
        "0x7bbcE28e64B3F8b84d876Ab298393c38ad7aac4C"
      );
      expect(config.chainName).to.equal("Avalanche Fuji");
      expect(config.explorerUrl).to.equal("https://testnet.snowtrace.io");
    });

    it("should throw for unsupported chain", function () {
      expect(() => getChainConfig(999)).to.throw(
        "No Wormhole Core address for chain ID: 999"
      );
    });
  });

  describe("isChainSupported", function () {
    it("should return true for supported Wormhole chain ID", function () {
      expect(isChainSupported(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE)).to.be.true;
      expect(isChainSupported(CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE)).to.be.true;
      expect(isChainSupported(CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE)).to.be.true;
    });

    it("should return false for unsupported chain", function () {
      expect(isChainSupported(999)).to.be.false;
      expect(isChainSupported(0)).to.be.false;
      expect(isChainSupported(-1)).to.be.false;
    });
  });
});
