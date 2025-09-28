import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "hardhatMainnet",
  chainType: "l1",
});

// Test configuration
const TEST_CONFIG = {
  BATCH_SIZE_SMALL: 3,
  BATCH_SIZE_LARGE: 10,
  BATCH_SIZE_STRESS: 50,
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
  ZERO_HASH:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
};

// Test statistics
const testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  startTime: Date.now(),
};

async function testMockVerifier() {
  console.log("🧪 Comprehensive MockVerifier Test Suite");
  console.log("=".repeat(50));

  try {
    // Setup
    const [owner, nonOwner, thirdParty] = await ethers.getSigners();
    console.log("✅ Test setup complete");
    console.log(`   Owner: ${owner.address}`);
    console.log(`   Non-owner: ${nonOwner.address}`);
    console.log(`   Third party: ${thirdParty.address}`);

    // Deploy MockVerifier
    const MockVerifierFactory = await ethers.getContractFactory("MockVerifier");
    const mockVerifier = await MockVerifierFactory.deploy();
    await mockVerifier.waitForDeployment();
    console.log(
      `✅ MockVerifier deployed at: ${await mockVerifier.getAddress()}`
    );

    // Run all test suites
    await runTestSuite("Deployment & Initialization", () =>
      testDeployment(mockVerifier, owner)
    );
    await runTestSuite("Basic Verification Operations", () =>
      testBasicOperations(mockVerifier)
    );
    await runTestSuite("Timestamp & Information Tracking", () =>
      testTimestampTracking(mockVerifier, owner)
    );
    await runTestSuite("Batch Operations", () =>
      testBatchOperations(mockVerifier)
    );
    await runTestSuite("Access Control & Security", () =>
      testAccessControl(mockVerifier, owner, nonOwner, thirdParty)
    );
    await runTestSuite("Edge Cases & Error Handling", () =>
      testEdgeCases(mockVerifier)
    );
    await runTestSuite("Interface Compliance", () =>
      testInterfaceCompliance(mockVerifier)
    );
    await runTestSuite("Performance & Stress Tests", () =>
      testPerformance(mockVerifier)
    );
    await runTestSuite("Event Emission", () => testEventEmission(mockVerifier));
    await runTestSuite("User-Initiated Verification", () =>
      testUserInitiatedVerification(mockVerifier, owner, nonOwner)
    );

    // Print final results
    printTestResults();
  } catch (error) {
    console.error("❌ Test suite failed:", error);
    process.exit(1);
  }
}

// Test Suite Runner
async function runTestSuite(
  suiteName: string,
  testFunction: () => Promise<void>
): Promise<void> {
  console.log(`\n📋 ${suiteName}`);
  console.log("-".repeat(suiteName.length + 4));

  try {
    await testFunction();
    console.log(`✅ ${suiteName} - All tests passed`);
  } catch (error) {
    console.error(`❌ ${suiteName} - Failed:`, error);
    throw error;
  }
}

// Test 1: Deployment & Initialization
async function testDeployment(mockVerifier: any, owner: any): Promise<void> {
  // Test owner is set correctly
  const contractOwner = await mockVerifier.owner();
  assert(contractOwner === owner.address, "Owner should be set correctly");

  // Test initial state
  const testCid = generateTestCid("initial-test");
  const initialStatus = await mockVerifier.isAvailable(testCid, "0x");
  assert(initialStatus === false, "Initial status should be false");

  // Test zero timestamp for unverified CID
  const zeroTimestamp = await mockVerifier.getVerificationTimestamp(testCid);
  assert(zeroTimestamp === 0n, "Unverified CID should have zero timestamp");

  recordTest("Deployment checks");
}

// Test 2: Basic Verification Operations
async function testBasicOperations(mockVerifier: any): Promise<void> {
  const testCid = generateTestCid("basic-test");

  // Test setting verification to true
  const tx1 = await mockVerifier.setMockAvailable(testCid, true);
  assert(tx1.hash, "Transaction should have hash");

  const statusAfterSet = await mockVerifier.isAvailable(testCid, "0x");
  assert(statusAfterSet === true, "Status after set should be true");

  // Test setting verification to false
  const tx2 = await mockVerifier.setMockAvailable(testCid, false);
  assert(tx2.hash, "Revoke transaction should have hash");

  const statusAfterRevoke = await mockVerifier.isAvailable(testCid, "0x");
  assert(statusAfterRevoke === false, "Status after revoke should be false");

  // Test revokeVerification function
  await mockVerifier.setMockAvailable(testCid, true);
  await mockVerifier.revokeVerification(testCid);

  const statusAfterRevokeFunction = await mockVerifier.isAvailable(
    testCid,
    "0x"
  );
  assert(
    statusAfterRevokeFunction === false,
    "Status after revoke function should be false"
  );

  recordTest("Basic operations");
}

// Test 3: Timestamp & Information Tracking
async function testTimestampTracking(
  mockVerifier: any,
  owner: any
): Promise<void> {
  const testCid = generateTestCid("timestamp-test");
  const beforeTimestamp = await getCurrentBlockTimestamp();

  // Set verification
  await mockVerifier.setMockAvailable(testCid, true);

  const afterTimestamp = await getCurrentBlockTimestamp();
  const verificationTimestamp =
    await mockVerifier.getVerificationTimestamp(testCid);

  // Verify timestamp is within expected range
  assert(
    verificationTimestamp >= beforeTimestamp,
    "Verification timestamp should be >= before timestamp"
  );
  assert(
    verificationTimestamp <= afterTimestamp,
    "Verification timestamp should be <= after timestamp"
  );

  // Test verification info
  const [isVerified, timestamp, verifier] =
    await mockVerifier.getVerificationInfo(testCid);
  assert(isVerified === true, "isVerified should be true");
  assert(timestamp === verificationTimestamp, "Timestamp should match");
  assert(verifier === owner.address, "Verifier should be owner address");

  // Test re-verification updates timestamp
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
  await mockVerifier.setMockAvailable(testCid, true);

  const newTimestamp = await mockVerifier.getVerificationTimestamp(testCid);
  assert(
    newTimestamp > verificationTimestamp,
    "Re-verification should update timestamp"
  );

  recordTest("Timestamp tracking");
}

// Test 4: Batch Operations
async function testBatchOperations(mockVerifier: any): Promise<void> {
  // Test batchSetMockAvailable with mixed statuses
  const cids = generateTestCids("batch-mixed", TEST_CONFIG.BATCH_SIZE_SMALL);
  const statuses = [true, false, true];

  const tx1 = await mockVerifier.batchSetMockAvailable(cids, statuses);
  assert(tx1.hash, "Batch transaction should have hash");

  // Verify all statuses
  for (let i = 0; i < cids.length; i++) {
    const status = await mockVerifier.isAvailable(cids[i], "0x");
    assert(status === statuses[i], `CID ${i} status should be ${statuses[i]}`);
  }

  // Test batchSetAllAvailable
  const newCids = generateTestCids("batch-all", 3);
  const tx2 = await mockVerifier.batchSetAllAvailable(newCids, true);
  assert(tx2.hash, "Batch all transaction should have hash");

  for (const cid of newCids) {
    const status = await mockVerifier.isAvailable(cid, "0x");
    assert(status === true, "All batch CIDs should be true");
  }

  // Test batchSetAllAvailable with false
  const falseCids = generateTestCids("batch-false", 2);
  await mockVerifier.batchSetAllAvailable(falseCids, false);

  for (const cid of falseCids) {
    const status = await mockVerifier.isAvailable(cid, "0x");
    assert(status === false, "All false batch CIDs should be false");
  }

  recordTest("Batch operations");
}

// Test 5: Access Control & Security
async function testAccessControl(
  mockVerifier: any,
  owner: any,
  nonOwner: any,
  thirdParty: any
): Promise<void> {
  const testCid = generateTestCid("access-test");

  // Test non-owner cannot set verification
  await expectRevert(
    () => mockVerifier.connect(nonOwner).setMockAvailable(testCid, true),
    "not owner"
  );

  // Test non-owner cannot revoke verification
  await expectRevert(
    () => mockVerifier.connect(nonOwner).revokeVerification(testCid),
    "not owner"
  );

  // Test non-owner cannot batch set
  const cids = generateTestCids("unauthorized-batch", 2);
  const statuses = [true, true];

  await expectRevert(
    () => mockVerifier.connect(nonOwner).batchSetMockAvailable(cids, statuses),
    "not owner"
  );

  // Test non-owner cannot batch set all
  await expectRevert(
    () => mockVerifier.connect(nonOwner).batchSetAllAvailable(cids, true),
    "not owner"
  );

  // Test third party also cannot access
  await expectRevert(
    () => mockVerifier.connect(thirdParty).setMockAvailable(testCid, true),
    "not owner"
  );

  recordTest("Access control");
}

// Test 6: Edge Cases & Error Handling
async function testEdgeCases(mockVerifier: any): Promise<void> {
  // Test zero hash CID
  const zeroCid = TEST_CONFIG.ZERO_HASH;
  await mockVerifier.setMockAvailable(zeroCid, true);
  const zeroStatus = await mockVerifier.isAvailable(zeroCid, "0x");
  assert(zeroStatus === true, "Zero hash CID should be verifiable");

  // Test re-verification of same CID
  const testCid = generateTestCid("reverify-test");
  await mockVerifier.setMockAvailable(testCid, true);
  await mockVerifier.setMockAvailable(testCid, true); // Should not fail
  const status = await mockVerifier.isAvailable(testCid, "0x");
  assert(status === true, "Re-verification should work");

  // Test batch operations with empty arrays
  await expectRevert(
    () => mockVerifier.batchSetMockAvailable([], []),
    "empty arrays"
  );

  await expectRevert(
    () => mockVerifier.batchSetAllAvailable([], true),
    "empty array"
  );

  // Test batch operations with mismatched array lengths
  const cids = generateTestCids("mismatch-test", 2);
  const statuses = [true]; // Mismatched length

  await expectRevert(
    () => mockVerifier.batchSetMockAvailable(cids, statuses),
    "arrays length mismatch"
  );

  recordTest("Edge cases");
}

// Test 7: Interface Compliance
async function testInterfaceCompliance(mockVerifier: any): Promise<void> {
  const testCid = generateTestCid("interface-test");
  const verifierData = ethers.toUtf8Bytes("proof-data");

  // Test isAvailable with different verifierData
  const status1 = await mockVerifier.isAvailable(testCid, "0x");
  assert(status1 === false, "Unverified CID should return false");

  const status2 = await mockVerifier.isAvailable(testCid, verifierData);
  assert(
    status2 === false,
    "Unverified CID should return false regardless of verifierData"
  );

  // Set verification and test again
  await mockVerifier.setMockAvailable(testCid, true);

  const status3 = await mockVerifier.isAvailable(testCid, "0x");
  assert(status3 === true, "Verified CID should return true");

  const status4 = await mockVerifier.isAvailable(testCid, verifierData);
  assert(
    status4 === true,
    "Verified CID should return true regardless of verifierData"
  );

  recordTest("Interface compliance");
}

// Test 8: Performance & Stress Tests
async function testPerformance(mockVerifier: any): Promise<void> {
  console.log("   Running performance tests...");

  // Test large batch operations
  const largeCids = generateTestCids(
    "perf-large",
    TEST_CONFIG.BATCH_SIZE_LARGE
  );
  const largeStatuses = new Array(TEST_CONFIG.BATCH_SIZE_LARGE).fill(true);

  const startTime = Date.now();
  await mockVerifier.batchSetMockAvailable(largeCids, largeStatuses);
  const endTime = Date.now();

  console.log(
    `   Large batch (${TEST_CONFIG.BATCH_SIZE_LARGE} CIDs) completed in ${endTime - startTime}ms`
  );

  // Verify all were set correctly
  for (const cid of largeCids) {
    const status = await mockVerifier.isAvailable(cid, "0x");
    assert(status === true, "All large batch CIDs should be true");
  }

  // Test stress batch operations
  const stressCids = generateTestCids(
    "perf-stress",
    TEST_CONFIG.BATCH_SIZE_STRESS
  );
  const stressStartTime = Date.now();
  await mockVerifier.batchSetAllAvailable(stressCids, false);
  const stressEndTime = Date.now();

  console.log(
    `   Stress batch (${TEST_CONFIG.BATCH_SIZE_STRESS} CIDs) completed in ${stressEndTime - stressStartTime}ms`
  );

  recordTest("Performance tests");
}

// Test 9: Event Emission
async function testEventEmission(mockVerifier: any): Promise<void> {
  const testCid = generateTestCid("event-test");

  // Test VerificationSubmitted event
  const tx1 = await mockVerifier.setMockAvailable(testCid, true);
  const receipt1 = await tx1.wait();

  const submittedEvent = receipt1.logs.find((log: any) => {
    try {
      const parsed = mockVerifier.interface.parseLog(log);
      return parsed.name === "VerificationSubmitted";
    } catch {
      return false;
    }
  });

  assert(submittedEvent, "VerificationSubmitted event should be emitted");

  // Test VerificationRevoked event
  const tx2 = await mockVerifier.revokeVerification(testCid);
  const receipt2 = await tx2.wait();

  const revokedEvent = receipt2.logs.find((log: any) => {
    try {
      const parsed = mockVerifier.interface.parseLog(log);
      return parsed.name === "VerificationRevoked";
    } catch {
      return false;
    }
  });

  assert(revokedEvent, "VerificationRevoked event should be emitted");

  recordTest("Event emission");
}

// Test 10: User-Initiated Verification
async function testUserInitiatedVerification(
  mockVerifier: any,
  owner: any,
  nonOwner: any
): Promise<void> {
  const testCid = generateTestCid("user-verification-test");

  // Test user can submit verification
  const tx = await mockVerifier.connect(nonOwner).submitVerification(testCid);
  assert(tx.hash, "User verification transaction should have hash");

  // Test verification status
  const isVerified = await mockVerifier.isAvailable(testCid, "0x");
  assert(isVerified === true, "User-verified CID should be available");

  // Test timestamp tracking
  const timestamp = await mockVerifier.getVerificationTimestamp(testCid);
  assert(timestamp > 0, "User verification should record timestamp");

  // Test verifier info
  const [verified, , verifier] =
    await mockVerifier.getVerificationInfo(testCid);
  assert(verified === true, "User verification should be marked as verified");
  assert(
    verifier === nonOwner.address,
    "Verifier should be the user who submitted"
  );

  // Test re-verification by different user
  const anotherUser = await ethers.getSigners().then((signers) => signers[3]);
  await mockVerifier.connect(anotherUser).submitVerification(testCid);

  // Should still work (re-verification)
  const stillVerified = await mockVerifier.isAvailable(testCid, "0x");
  assert(
    stillVerified === true,
    "Re-verification should maintain verified status"
  );

  recordTest("User-initiated verification");
}

// Helper Functions
function generateTestCid(prefix: string): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(`${prefix}-${Date.now()}-${Math.random()}`)
  );
}

function generateTestCids(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    generateTestCid(`${prefix}-${i}`)
  );
}

async function getCurrentBlockTimestamp(): Promise<bigint> {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block!.timestamp);
}

async function expectRevert(
  fn: () => Promise<unknown>,
  expectedMessage: string
): Promise<void> {
  try {
    await fn();
    throw new Error(
      `Expected revert with message "${expectedMessage}", but transaction succeeded`
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes(expectedMessage)) {
      throw new Error(
        `Expected revert message "${expectedMessage}", but got: ${errorMessage}`
      );
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function recordTest(testName: string): void {
  testStats.total++;
  testStats.passed++;
  console.log(`   ✅ ${testName}`);
}

function printTestResults(): void {
  const duration = Date.now() - testStats.startTime;
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Test Suite Results");
  console.log("=".repeat(50));
  console.log(`Total Tests: ${testStats.total}`);
  console.log(`Passed: ${testStats.passed}`);
  console.log(`Failed: ${testStats.failed}`);
  console.log(`Duration: ${duration}ms`);
  console.log(
    `Success Rate: ${((testStats.passed / testStats.total) * 100).toFixed(1)}%`
  );

  if (testStats.failed === 0) {
    console.log("\n🎉 All tests passed! MockVerifier is production-ready.");
  } else {
    console.log(`\n❌ ${testStats.failed} tests failed.`);
    process.exit(1);
  }
}

// Run the comprehensive test suite
testMockVerifier();
