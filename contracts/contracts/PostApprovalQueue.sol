// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PostApprovalQueue
 * @notice Manages a parent-approval workflow for social-media posts created by minors.
 * @dev Each post is assigned a unique incrementing ID. Parents (or the owner) approve/reject.
 *      The FamilyRegistry address is stored for future on-chain parent lookups if desired.
 */
contract PostApprovalQueue is Ownable {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum PostStatus {
        Pending,   // 0
        Approved,  // 1
        Rejected   // 2
    }

    struct Post {
        uint256     id;
        address     child;
        bytes32     contentHash;
        string      platform;
        PostStatus  status;
        bytes32     rejectionReason;
        uint256     submittedAt;
        uint256     resolvedAt;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 private _postCounter;

    /// @notice All posts by ID.
    mapping(uint256 => Post) public posts;

    /// @notice All post IDs submitted by a child wallet.
    mapping(address => uint256[]) public childPosts;

    /// @notice Pending post IDs visible to a parent wallet.
    mapping(address => uint256[]) public parentPendingPosts;

    /// @notice Address of the deployed FamilyRegistry contract.
    address public familyRegistry;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event PostSubmitted(
        address indexed child,
        uint256 indexed postId,
        bytes32         contentHash,
        string          platform
    );

    event PostApproved(
        address indexed parent,
        uint256 indexed postId
    );

    event PostRejected(
        address indexed parent,
        uint256 indexed postId,
        bytes32         reason
    );

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param initialOwner    Address that will own this contract.
     * @param familyRegistry_ Address of the FamilyRegistry contract.
     */
    constructor(address initialOwner, address familyRegistry_) Ownable(initialOwner) {
        require(familyRegistry_ != address(0), "PostApprovalQueue: invalid registry address");
        familyRegistry = familyRegistry_;
    }

    // -------------------------------------------------------------------------
    // Mutating functions
    // -------------------------------------------------------------------------

    /**
     * @notice Submit a new post for parental approval.
     * @dev Callable by anyone (typically the backend on behalf of the child).
     *      The `parentPendingPosts` mapping is keyed by the parent supplied at call-time;
     *      the caller is responsible for supplying the correct parent address
     *      (retrieved from FamilyRegistry off-chain or via a wrapper).
     * @param child       The child wallet that created the post.
     * @param contentHash keccak256 hash of the post content / IPFS CID.
     * @param platform    Human-readable platform identifier (e.g. "instagram").
     * @return postId     The newly assigned post ID.
     */
    function submitPost(
        address        child,
        bytes32        contentHash,
        string calldata platform
    ) external returns (uint256 postId) {
        require(child != address(0), "PostApprovalQueue: child is zero address");
        require(contentHash != bytes32(0), "PostApprovalQueue: empty content hash");
        require(bytes(platform).length > 0, "PostApprovalQueue: platform required");

        _postCounter++;
        postId = _postCounter;

        posts[postId] = Post({
            id:              postId,
            child:           child,
            contentHash:     contentHash,
            platform:        platform,
            status:          PostStatus.Pending,
            rejectionReason: bytes32(0),
            submittedAt:     block.timestamp,
            resolvedAt:      0
        });

        childPosts[child].push(postId);

        emit PostSubmitted(child, postId, contentHash, platform);
    }

    /**
     * @notice Record a post submission against a specific parent's pending queue.
     * @dev Call this after submitPost if you want parentPendingPosts populated.
     *      Separated so that the core submitPost stays clean and gas-efficient
     *      when the parent isn't known on-chain at submission time.
     * @param parent The parent wallet to notify.
     * @param postId The post ID returned by submitPost.
     */
    function queueForParent(address parent, uint256 postId) external {
        require(parent != address(0), "PostApprovalQueue: parent is zero address");
        require(posts[postId].id == postId, "PostApprovalQueue: post does not exist");
        require(
            posts[postId].status == PostStatus.Pending,
            "PostApprovalQueue: post is not pending"
        );
        parentPendingPosts[parent].push(postId);
    }

    /**
     * @notice Approve a pending post.
     * @param postId The ID of the post to approve.
     */
    function approvePost(uint256 postId) external {
        Post storage post = posts[postId];
        require(post.id == postId,                      "PostApprovalQueue: post does not exist");
        require(post.status == PostStatus.Pending,      "PostApprovalQueue: post is not pending");

        post.status     = PostStatus.Approved;
        post.resolvedAt = block.timestamp;

        emit PostApproved(msg.sender, postId);
    }

    /**
     * @notice Reject a pending post with a reason.
     * @param postId The ID of the post to reject.
     * @param reason A bytes32-encoded reason code or short string hash.
     */
    function rejectPost(uint256 postId, bytes32 reason) external {
        Post storage post = posts[postId];
        require(post.id == postId,                 "PostApprovalQueue: post does not exist");
        require(post.status == PostStatus.Pending, "PostApprovalQueue: post is not pending");

        post.status          = PostStatus.Rejected;
        post.rejectionReason = reason;
        post.resolvedAt      = block.timestamp;

        emit PostRejected(msg.sender, postId, reason);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /**
     * @notice Count how many of a child's posts are still pending.
     * @param child The child wallet address.
     * @return count Number of posts with status Pending.
     */
    function getPendingCount(address child) external view returns (uint256 count) {
        uint256[] storage ids = childPosts[child];
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; ) {
            if (posts[ids[i]].status == PostStatus.Pending) {
                count++;
            }
            unchecked { i++; }
        }
    }

    /**
     * @notice Return approved, rejected, and pending counts for a child's posts.
     * @param child The child wallet address.
     * @return approved  Number of approved posts.
     * @return rejected  Number of rejected posts.
     * @return pending   Number of pending posts.
     */
    function getPostStats(address child)
        external
        view
        returns (uint256 approved, uint256 rejected, uint256 pending)
    {
        uint256[] storage ids = childPosts[child];
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; ) {
            PostStatus s = posts[ids[i]].status;
            if (s == PostStatus.Approved) {
                approved++;
            } else if (s == PostStatus.Rejected) {
                rejected++;
            } else {
                pending++;
            }
            unchecked { i++; }
        }
    }

    /**
     * @notice Retrieve a post by ID.
     * @param postId The post ID to look up.
     * @return The Post struct.
     */
    function getPost(uint256 postId) external view returns (Post memory) {
        require(posts[postId].id == postId, "PostApprovalQueue: post does not exist");
        return posts[postId];
    }
}
