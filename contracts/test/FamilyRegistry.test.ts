import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FamilyRegistry } from "../typechain-types";

describe("FamilyRegistry", function () {
  let registry: FamilyRegistry;
  let owner: HardhatEthersSigner;
  let parent: HardhatEthersSigner;
  let child: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  // AgeTier enum values (must match contract order)
  const AgeTier = {
    Under13:   0n,
    Age13to15: 1n,
    Age16to17: 2n,
    Age18Plus: 3n,
  } as const;

  beforeEach(async function () {
    [owner, parent, child, stranger] = await ethers.getSigners();

    const FamilyRegistryFactory = await ethers.getContractFactory("FamilyRegistry");
    registry = (await FamilyRegistryFactory.deploy(owner.address)) as FamilyRegistry;
    await registry.waitForDeployment();
  });

  // ---------------------------------------------------------------------------
  // Deployment
  // ---------------------------------------------------------------------------

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });
  });

  // ---------------------------------------------------------------------------
  // registerFamily
  // ---------------------------------------------------------------------------

  describe("registerFamily", function () {
    it("should allow the owner to register a family link", async function () {
      await expect(
        registry.connect(owner).registerFamily(
          parent.address,
          child.address,
          AgeTier.Age13to15
        )
      )
        .to.emit(registry, "FamilyRegistered")
        .withArgs(parent.address, child.address, AgeTier.Age13to15);
    });

    it("should allow the parent themselves to register a child", async function () {
      await expect(
        registry.connect(parent).registerFamily(
          parent.address,
          child.address,
          AgeTier.Age16to17
        )
      )
        .to.emit(registry, "FamilyRegistered")
        .withArgs(parent.address, child.address, AgeTier.Age16to17);
    });

    it("should revert when called by a stranger", async function () {
      await expect(
        registry.connect(stranger).registerFamily(
          parent.address,
          child.address,
          AgeTier.Under13
        )
      ).to.be.revertedWith("FamilyRegistry: caller must be owner or parent");
    });

    it("should revert when child is already registered", async function () {
      await registry.connect(owner).registerFamily(
        parent.address,
        child.address,
        AgeTier.Age13to15
      );
      await expect(
        registry.connect(owner).registerFamily(
          parent.address,
          child.address,
          AgeTier.Age13to15
        )
      ).to.be.revertedWith("FamilyRegistry: child already registered");
    });

    it("should revert when parent and child are the same address", async function () {
      await expect(
        registry.connect(owner).registerFamily(
          parent.address,
          parent.address,
          AgeTier.Age18Plus
        )
      ).to.be.revertedWith("FamilyRegistry: parent and child must differ");
    });

    it("should revert when parent is zero address", async function () {
      await expect(
        registry.connect(owner).registerFamily(
          ethers.ZeroAddress,
          child.address,
          AgeTier.Under13
        )
      ).to.be.revertedWith("FamilyRegistry: parent is zero address");
    });

    it("should revert when child is zero address", async function () {
      await expect(
        registry.connect(owner).registerFamily(
          parent.address,
          ethers.ZeroAddress,
          AgeTier.Under13
        )
      ).to.be.revertedWith("FamilyRegistry: child is zero address");
    });
  });

  // ---------------------------------------------------------------------------
  // getChildren
  // ---------------------------------------------------------------------------

  describe("getChildren", function () {
    it("should return the registered child address", async function () {
      await registry.connect(owner).registerFamily(
        parent.address,
        child.address,
        AgeTier.Age13to15
      );

      const children = await registry.getChildren(parent.address);
      expect(children).to.have.lengthOf(1);
      expect(children[0]).to.equal(child.address);
    });

    it("should return multiple children for the same parent", async function () {
      const [, , , , secondChild] = await ethers.getSigners();

      await registry.connect(owner).registerFamily(
        parent.address,
        child.address,
        AgeTier.Age13to15
      );
      await registry.connect(owner).registerFamily(
        parent.address,
        secondChild.address,
        AgeTier.Age16to17
      );

      const children = await registry.getChildren(parent.address);
      expect(children).to.have.lengthOf(2);
      expect(children).to.include(child.address);
      expect(children).to.include(secondChild.address);
    });

    it("should return an empty array for an unregistered parent", async function () {
      const children = await registry.getChildren(stranger.address);
      expect(children).to.have.lengthOf(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getAgeTier
  // ---------------------------------------------------------------------------

  describe("getAgeTier", function () {
    it("should return the correct age tier for a registered child", async function () {
      await registry.connect(owner).registerFamily(
        parent.address,
        child.address,
        AgeTier.Age16to17
      );

      const tier = await registry.getAgeTier(child.address);
      expect(tier).to.equal(AgeTier.Age16to17);
    });

    it("should return Under13 (default) for an unregistered address", async function () {
      // Solidity default for enum is 0 (Under13)
      const tier = await registry.getAgeTier(stranger.address);
      expect(tier).to.equal(AgeTier.Under13);
    });
  });

  // ---------------------------------------------------------------------------
  // getParent
  // ---------------------------------------------------------------------------

  describe("getParent", function () {
    it("should return the parent address for a registered child", async function () {
      await registry.connect(owner).registerFamily(
        parent.address,
        child.address,
        AgeTier.Age13to15
      );

      expect(await registry.getParent(child.address)).to.equal(parent.address);
    });

    it("should return zero address for an unregistered child", async function () {
      expect(await registry.getParent(stranger.address)).to.equal(ethers.ZeroAddress);
    });
  });

  // ---------------------------------------------------------------------------
  // isRegistered
  // ---------------------------------------------------------------------------

  describe("isRegistered", function () {
    it("should return true for a registered child", async function () {
      await registry.connect(owner).registerFamily(
        parent.address,
        child.address,
        AgeTier.Age13to15
      );

      expect(await registry.isRegistered(child.address)).to.be.true;
    });

    it("should return false for an unregistered address", async function () {
      expect(await registry.isRegistered(stranger.address)).to.be.false;
    });
  });

  // ---------------------------------------------------------------------------
  // removeChild
  // ---------------------------------------------------------------------------

  describe("removeChild", function () {
    beforeEach(async function () {
      await registry.connect(owner).registerFamily(
        parent.address,
        child.address,
        AgeTier.Age13to15
      );
    });

    it("should allow the parent to remove their child", async function () {
      await expect(registry.connect(parent).removeChild(child.address))
        .to.emit(registry, "ChildRemoved")
        .withArgs(parent.address, child.address);
    });

    it("should set isActive to false in the FamilyLink after removal", async function () {
      await registry.connect(parent).removeChild(child.address);

      const link = await registry.getFamilyLink(parent.address, child.address);
      expect(link.isActive).to.be.false;
    });

    it("should make isRegistered return false after removal", async function () {
      await registry.connect(parent).removeChild(child.address);
      expect(await registry.isRegistered(child.address)).to.be.false;
    });

    it("should clear childToParent mapping after removal", async function () {
      await registry.connect(parent).removeChild(child.address);
      expect(await registry.getParent(child.address)).to.equal(ethers.ZeroAddress);
    });

    it("should revert when called by a stranger", async function () {
      await expect(
        registry.connect(stranger).removeChild(child.address)
      ).to.be.revertedWith("FamilyRegistry: caller is not the child's parent");
    });

    it("should revert when child is not registered", async function () {
      await expect(
        registry.connect(parent).removeChild(stranger.address)
      ).to.be.revertedWith("FamilyRegistry: child not registered");
    });
  });

  // ---------------------------------------------------------------------------
  // getFamilyLink
  // ---------------------------------------------------------------------------

  describe("getFamilyLink", function () {
    it("should return a populated FamilyLink for a registered pair", async function () {
      await registry.connect(owner).registerFamily(
        parent.address,
        child.address,
        AgeTier.Age18Plus
      );

      const link = await registry.getFamilyLink(parent.address, child.address);
      expect(link.parent).to.equal(parent.address);
      expect(link.child).to.equal(child.address);
      expect(link.ageTier).to.equal(AgeTier.Age18Plus);
      expect(link.isActive).to.be.true;
      expect(link.linkedAt).to.be.greaterThan(0n);
    });

    it("should return an empty/zeroed FamilyLink for an unregistered pair", async function () {
      const link = await registry.getFamilyLink(parent.address, child.address);
      expect(link.parent).to.equal(ethers.ZeroAddress);
      expect(link.child).to.equal(ethers.ZeroAddress);
      expect(link.isActive).to.be.false;
    });
  });
});
