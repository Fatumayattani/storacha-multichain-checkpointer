import { expect } from "chai";
import {
  CHAIN_IDS,
  evmToWormholeChainId,
  wormholeToEvmChainId,
  isSupportedEvmChainId,
  isSupportedWormholeChainId,
  getChainName,
} from "../../constants/chainIds.js";

describe("Chain ID Constants", function () {
  describe("CHAIN_IDS", function () {
    it("should have correct EVM chain IDs", function () {
      expect(CHAIN_IDS.BASE_SEPOLIA_EVM).to.equal(84532);
      expect(CHAIN_IDS.AVALANCHE_FUJI_EVM).to.equal(43113);
      expect(CHAIN_IDS.ETHEREUM_SEPOLIA_EVM).to.equal(11155111);
    });

    it("should have correct Wormhole chain IDs", function () {
      expect(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE).to.equal(10004);
      expect(CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE).to.equal(6);
      expect(CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE).to.equal(10002);
    });
  });

  describe("evmToWormholeChainId", function () {
    it("should convert Base Sepolia EVM to Wormhole", function () {
      const result = evmToWormholeChainId(CHAIN_IDS.BASE_SEPOLIA_EVM);
      expect(result).to.equal(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
    });

    it("should convert Avalanche Fuji EVM to Wormhole", function () {
      const result = evmToWormholeChainId(CHAIN_IDS.AVALANCHE_FUJI_EVM);
      expect(result).to.equal(CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE);
    });

    it("should convert Ethereum Sepolia EVM to Wormhole", function () {
      const result = evmToWormholeChainId(CHAIN_IDS.ETHEREUM_SEPOLIA_EVM);
      expect(result).to.equal(CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE);
    });

    it("should throw error for unsupported EVM chain ID", function () {
      expect(() => evmToWormholeChainId(999999)).to.throw(
        "Unsupported EVM chain ID: 999999"
      );
    });
  });

  describe("wormholeToEvmChainId", function () {
    it("should convert Base Sepolia Wormhole to EVM", function () {
      const result = wormholeToEvmChainId(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE);
      expect(result).to.equal(CHAIN_IDS.BASE_SEPOLIA_EVM);
    });

    it("should convert Avalanche Fuji Wormhole to EVM", function () {
      const result = wormholeToEvmChainId(CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE);
      expect(result).to.equal(CHAIN_IDS.AVALANCHE_FUJI_EVM);
    });

    it("should convert Ethereum Sepolia Wormhole to EVM", function () {
      const result = wormholeToEvmChainId(CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE);
      expect(result).to.equal(CHAIN_IDS.ETHEREUM_SEPOLIA_EVM);
    });

    it("should throw error for unsupported Wormhole chain ID", function () {
      expect(() => wormholeToEvmChainId(999999)).to.throw(
        "Unsupported Wormhole chain ID: 999999"
      );
    });
  });

  describe("isSupportedEvmChainId", function () {
    it("should return true for supported EVM chain IDs", function () {
      expect(isSupportedEvmChainId(CHAIN_IDS.BASE_SEPOLIA_EVM)).to.be.true;
      expect(isSupportedEvmChainId(CHAIN_IDS.AVALANCHE_FUJI_EVM)).to.be.true;
      expect(isSupportedEvmChainId(CHAIN_IDS.ETHEREUM_SEPOLIA_EVM)).to.be.true;
    });

    it("should return false for unsupported EVM chain IDs", function () {
      expect(isSupportedEvmChainId(999999)).to.be.false;
      expect(isSupportedEvmChainId(0)).to.be.false;
      expect(isSupportedEvmChainId(-1)).to.be.false;
    });
  });

  describe("isSupportedWormholeChainId", function () {
    it("should return true for supported Wormhole chain IDs", function () {
      expect(isSupportedWormholeChainId(CHAIN_IDS.BASE_SEPOLIA_WORMHOLE)).to.be
        .true;
      expect(isSupportedWormholeChainId(CHAIN_IDS.AVALANCHE_FUJI_WORMHOLE)).to
        .be.true;
      expect(isSupportedWormholeChainId(CHAIN_IDS.ETHEREUM_SEPOLIA_WORMHOLE)).to
        .be.true;
    });

    it("should return false for unsupported Wormhole chain IDs", function () {
      expect(isSupportedWormholeChainId(999999)).to.be.false;
      expect(isSupportedWormholeChainId(0)).to.be.false;
      expect(isSupportedWormholeChainId(-1)).to.be.false;
    });
  });

  describe("getChainName", function () {
    it("should return correct chain names", function () {
      expect(getChainName(CHAIN_IDS.BASE_SEPOLIA_EVM)).to.equal("Base Sepolia");
      expect(getChainName(CHAIN_IDS.AVALANCHE_FUJI_EVM)).to.equal(
        "Avalanche Fuji"
      );
      expect(getChainName(CHAIN_IDS.ETHEREUM_SEPOLIA_EVM)).to.equal(
        "Ethereum Sepolia"
      );
    });

    it("should return 'Unknown Chain' for unsupported chain IDs", function () {
      expect(getChainName(999999)).to.equal("Unknown Chain");
    });
  });

  describe("Bidirectional conversion consistency", function () {
    it("should maintain consistency in both directions", function () {
      // Test all supported chains
      const evmChains = [
        CHAIN_IDS.BASE_SEPOLIA_EVM,
        CHAIN_IDS.AVALANCHE_FUJI_EVM,
        CHAIN_IDS.ETHEREUM_SEPOLIA_EVM,
      ];

      for (const evmChainId of evmChains) {
        const wormholeChainId = evmToWormholeChainId(evmChainId);
        const backToEvm = wormholeToEvmChainId(wormholeChainId);
        expect(backToEvm).to.equal(evmChainId);
      }
    });
  });
});
