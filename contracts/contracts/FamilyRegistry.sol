// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FamilyRegistry
 * @notice Stores parent-child wallet relationships and age tiers for the CertainID Family platform.
 * @dev Only the contract owner (deployer/backend) or the parent themselves may register a child.
 */
contract FamilyRegistry is Ownable {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum AgeTier {
        Under13,    // 0
        Age13to15,  // 1
        Age16to17,  // 2
        Age18Plus   // 3
    }

    struct FamilyLink {
        address parent;
        address child;
        AgeTier ageTier;
        uint256 linkedAt;
        bool    isActive;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice All children registered under a parent wallet.
    mapping(address => address[]) public parentToChildren;

    /// @notice The parent wallet for a given child wallet (zero address if unregistered).
    mapping(address => address) public childToParent;

    /// @notice The age tier assigned to a child wallet.
    mapping(address => AgeTier) public childToAgeTier;

    /// @notice Full FamilyLink record keyed by keccak256(abi.encodePacked(parent, child)).
    mapping(bytes32 => FamilyLink) public familyLinks;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event FamilyRegistered(
        address indexed parent,
        address indexed child,
        AgeTier ageTier
    );

    event ChildRemoved(
        address indexed parent,
        address indexed child
    );

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param initialOwner Address that will own this contract (passed to Ownable).
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Mutating functions
    // -------------------------------------------------------------------------

    /**
     * @notice Register a parent-child relationship on-chain.
     * @dev Callable by the contract owner (backend) or by the parent themselves.
     *      A child address may only have one active parent.
     * @param parent  The parent's wallet address.
     * @param child   The child's wallet address.
     * @param ageTier The child's verified age tier.
     */
    function registerFamily(
        address parent,
        address child,
        AgeTier ageTier
    ) external {
        require(
            msg.sender == owner() || msg.sender == parent,
            "FamilyRegistry: caller must be owner or parent"
        );
        require(parent != address(0), "FamilyRegistry: parent is zero address");
        require(child  != address(0), "FamilyRegistry: child is zero address");
        require(parent != child,      "FamilyRegistry: parent and child must differ");
        require(
            childToParent[child] == address(0),
            "FamilyRegistry: child already registered"
        );

        bytes32 linkId = _linkId(parent, child);

        parentToChildren[parent].push(child);
        childToParent[child]  = parent;
        childToAgeTier[child] = ageTier;
        familyLinks[linkId]   = FamilyLink({
            parent:    parent,
            child:     child,
            ageTier:   ageTier,
            linkedAt:  block.timestamp,
            isActive:  true
        });

        emit FamilyRegistered(parent, child, ageTier);
    }

    /**
     * @notice Deactivate a child's link. Only callable by the child's registered parent.
     * @param child The child wallet to remove.
     */
    function removeChild(address child) external {
        address parent = childToParent[child];
        require(parent != address(0), "FamilyRegistry: child not registered");
        require(msg.sender == parent, "FamilyRegistry: caller is not the child's parent");

        bytes32 linkId = _linkId(parent, child);
        familyLinks[linkId].isActive = false;

        // Clear mappings so the child can be re-registered under a different parent if needed.
        childToParent[child] = address(0);

        emit ChildRemoved(parent, child);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /**
     * @notice Return all child addresses ever pushed under `parent`.
     * @dev Includes children that have since been removed (isActive == false in familyLinks).
     *      Callers should cross-reference with getFamilyLink if filtering is needed.
     */
    function getChildren(address parent) external view returns (address[] memory) {
        return parentToChildren[parent];
    }

    /**
     * @notice Return the age tier for `child`.
     */
    function getAgeTier(address child) external view returns (AgeTier) {
        return childToAgeTier[child];
    }

    /**
     * @notice Return the parent address for `child` (zero address if unregistered / removed).
     */
    function getParent(address child) external view returns (address) {
        return childToParent[child];
    }

    /**
     * @notice Return whether `child` currently has an active parent registration.
     */
    function isRegistered(address child) external view returns (bool) {
        return childToParent[child] != address(0);
    }

    /**
     * @notice Return the full FamilyLink struct for a (parent, child) pair.
     */
    function getFamilyLink(
        address parent,
        address child
    ) external view returns (FamilyLink memory) {
        return familyLinks[_linkId(parent, child)];
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _linkId(address parent, address child) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(parent, child));
    }
}
