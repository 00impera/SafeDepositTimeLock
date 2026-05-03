// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IRewardToken {
    function mintRewards(address to, uint256 amount) external;
    function setDistributor(address _distributor) external;
    function mint(address to, uint256 amount) external returns (bool);
    function transferOwnership(address newOwner) external;
}

contract LiquidStaking is Ownable, ReentrancyGuard {

    uint256 public constant RATE_PER_DAY  = 1e18;
    uint256 public constant UNSTAKE_DELAY = 7 days;
    uint256 public constant PENALTY_BPS   = 1000;
    uint256 public constant BPS_BASE      = 10_000;

    address public goldToken;
    address public dragonToken;
    address public treasury;

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 pendingRewards;
        uint256 unstakeAmount;
        uint256 unstakeAt;
    }

    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount);
    event UnstakeRequested(address indexed user, uint256 amount, uint256 claimableAt);
    event Unstaked(address indexed user, uint256 amount);
    event InstantUnstaked(address indexed user, uint256 amount, uint256 penalty);
    event RewardsClaimed(address indexed user, uint256 goldAmt, uint256 dragonAmt);

    constructor(
        address _owner,
        address _goldToken,
        address _dragonToken,
        address _treasury
    ) Ownable(_owner) {
        require(_goldToken   != address(0), "Bad gold");
        require(_dragonToken != address(0), "Bad dragon");
        require(_treasury    != address(0), "Bad treasury");
        goldToken   = _goldToken;
        dragonToken = _dragonToken;
        treasury    = _treasury;
    }

    function stake() external payable nonReentrant {
        require(msg.value > 0, "Zero stake");
        _accrueRewards(msg.sender);
        stakes[msg.sender].amount += msg.value;
        stakes[msg.sender].stakedAt = block.timestamp;
        totalStaked += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function requestUnstake(uint256 amount) external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(amount > 0 && amount <= s.amount, "Bad amount");
        require(s.unstakeAmount == 0, "Pending unstake exists");
        _accrueRewards(msg.sender);
        s.amount       -= amount;
        s.unstakeAmount = amount;
        s.unstakeAt     = block.timestamp + UNSTAKE_DELAY;
        totalStaked    -= amount;
        emit UnstakeRequested(msg.sender, amount, s.unstakeAt);
    }

    function claimUnstake() external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(s.unstakeAmount > 0, "Nothing to claim");
        require(block.timestamp >= s.unstakeAt, "Still cooling down");
        uint256 amount  = s.unstakeAmount;
        s.unstakeAmount = 0;
        s.unstakeAt     = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        emit Unstaked(msg.sender, amount);
    }

    function instantUnstake(uint256 amount) external nonReentrant {
        StakeInfo storage s = stakes[msg.sender];
        require(amount > 0 && amount <= s.amount, "Bad amount");
        _accrueRewards(msg.sender);
        s.amount    -= amount;
        totalStaked -= amount;
        uint256 penalty = (amount * PENALTY_BPS) / BPS_BASE;
        uint256 payout  = amount - penalty;
        (bool t1,) = treasury.call{value: penalty}("");
        require(t1, "Treasury failed");
        (bool t2,) = msg.sender.call{value: payout}("");
        require(t2, "Payout failed");
        emit InstantUnstaked(msg.sender, payout, penalty);
    }

    function claimRewards() external nonReentrant {
        _accrueRewards(msg.sender);
        StakeInfo storage s = stakes[msg.sender];
        uint256 rewards = s.pendingRewards;
        require(rewards > 0, "No rewards");
        s.pendingRewards = 0;
        s.stakedAt       = block.timestamp;
        IRewardToken(goldToken).mint(msg.sender, rewards);
        IRewardToken(dragonToken).mintRewards(msg.sender, rewards);
        emit RewardsClaimed(msg.sender, rewards, rewards);
    }

    function pendingRewards(address user) external view returns (uint256) {
        StakeInfo memory s = stakes[user];
        if (s.amount == 0) return s.pendingRewards;
        uint256 elapsed = block.timestamp - s.stakedAt;
        uint256 accrued = (s.amount * RATE_PER_DAY * elapsed) / (1 days * 1e18);
        return s.pendingRewards + accrued;
    }

    function stakeInfo(address user) external view returns (
        uint256 amount, uint256 stakedAt, uint256 pending,
        uint256 unstakeAmount, uint256 unstakeAt, bool canClaim
    ) {
        StakeInfo memory s = stakes[user];
        uint256 elapsed    = s.amount > 0 ? block.timestamp - s.stakedAt : 0;
        uint256 accrued    = (s.amount * RATE_PER_DAY * elapsed) / (1 days * 1e18);
        return (s.amount, s.stakedAt, s.pendingRewards + accrued,
                s.unstakeAmount, s.unstakeAt,
                s.unstakeAmount > 0 && block.timestamp >= s.unstakeAt);
    }

    // ── ADMIN ──────────────────────────────────────────────
    function initDragonDistributor() external onlyOwner {
        IRewardToken(dragonToken).setDistributor(address(this));
    }

    // RESCUE: transfera ownership DRAGON la o alta adresa
    function transferDragonOwnership(address newOwner) external onlyOwner {
        IRewardToken(dragonToken).transferOwnership(newOwner);
    }

    function setTokens(address _gold, address _dragon) external onlyOwner {
        goldToken = _gold; dragonToken = _dragon;
    }

    function setTreasury(address _t) external onlyOwner {
        treasury = _t;
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 b = address(this).balance - totalStaked;
        require(b > 0, "Nothing");
        (bool ok,) = owner().call{value: b}("");
        require(ok, "Failed");
    }

    function _accrueRewards(address user) internal {
        StakeInfo storage s = stakes[user];
        if (s.amount == 0 || s.stakedAt == 0) { s.stakedAt = block.timestamp; return; }
        uint256 elapsed   = block.timestamp - s.stakedAt;
        uint256 accrued   = (s.amount * RATE_PER_DAY * elapsed) / (1 days * 1e18);
        s.pendingRewards += accrued;
        s.stakedAt        = block.timestamp;
    }

    receive() external payable {}
}
