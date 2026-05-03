// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IVaultNFT.sol";

contract TimeVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_PERCENT       = 2;
    uint256 public constant EARLY_FEE_PERCENT = 2;
    uint256 public constant MIN_LOCK_DAYS     = 1;
    uint256 public constant MAX_LOCK_DAYS     = 3650;
    uint256[] public FIXED_PERIODS = [30, 90, 180, 365];

    address public nftContract;
    bool    public nftContractLocked;
    uint256 public accumulatedFees;
    uint256 private _nextLockId;

    struct LockInfo {
        address owner;
        address token;
        uint256 amount;
        uint256 lockedAt;
        uint256 unlockTime;
        bool    withdrawn;
    }

    mapping(uint256 => LockInfo)  private _locks;
    mapping(address => uint256[]) private _userLocks;
    mapping(uint256 => uint256)   public  nftToLock;

    event Deposited(uint256 indexed lockId, address indexed user, address token, uint256 amount, uint256 unlockTime, uint256 nftTokenId);
    event Withdrawn(uint256 indexed lockId, address indexed user, uint256 amount);
    event EarlyWithdrawn(uint256 indexed lockId, address indexed user, uint256 amount, uint256 penalty);
    event NFTContractSet(address indexed nft);
    event NFTContractFinalized(address indexed nft);
    event FeesWithdrawn(address indexed owner, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setNFTContract(address nft) external onlyOwner {
        require(!nftContractLocked, "Already finalized");
        require(nft != address(0), "Zero address");
        nftContract = nft;
        emit NFTContractSet(nft);
    }

    function finalizeNFTContract() external onlyOwner {
        require(nftContract != address(0), "NFT not set");
        nftContractLocked = true;
        emit NFTContractFinalized(nftContract);
    }

    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees");
        accumulatedFees = 0;
        (bool ok,) = owner().call{value: amount}("");
        require(ok, "Fee transfer failed");
        emit FeesWithdrawn(owner(), amount);
    }

    function depositMON(uint256 lockDays) external payable nonReentrant {
        require(msg.value > 0, "No MON sent");
        require(lockDays >= MIN_LOCK_DAYS && lockDays <= MAX_LOCK_DAYS, "Invalid lock period");
        uint256 fee = (msg.value * FEE_PERCENT) / 100;
        accumulatedFees += fee;
        uint256 lockId = _createLock(msg.sender, address(0), msg.value - fee, lockDays);
        uint256 nftId  = IVaultNFT(nftContract).mint(msg.sender, lockId);
        nftToLock[nftId] = lockId;
        emit Deposited(lockId, msg.sender, address(0), msg.value - fee, _locks[lockId].unlockTime, nftId);
    }

    function depositMONFixed(uint256 periodIndex) external payable nonReentrant {
        require(periodIndex < FIXED_PERIODS.length, "Invalid period index");
        require(msg.value > 0, "No MON sent");
        uint256 fee    = (msg.value * FEE_PERCENT) / 100;
        accumulatedFees += fee;
        uint256 lockId = _createLock(msg.sender, address(0), msg.value - fee, FIXED_PERIODS[periodIndex]);
        uint256 nftId  = IVaultNFT(nftContract).mint(msg.sender, lockId);
        nftToLock[nftId] = lockId;
        emit Deposited(lockId, msg.sender, address(0), msg.value - fee, _locks[lockId].unlockTime, nftId);
    }

    function depositERC20(address token, uint256 amount, uint256 lockDays) external nonReentrant {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Zero amount");
        require(lockDays >= MIN_LOCK_DAYS && lockDays <= MAX_LOCK_DAYS, "Invalid lock period");
        uint256 fee = (amount * FEE_PERCENT) / 100;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).safeTransfer(owner(), fee);
        uint256 lockId = _createLock(msg.sender, token, amount - fee, lockDays);
        uint256 nftId  = IVaultNFT(nftContract).mint(msg.sender, lockId);
        nftToLock[nftId] = lockId;
        emit Deposited(lockId, msg.sender, token, amount - fee, _locks[lockId].unlockTime, nftId);
    }

    function depositERC20Fixed(address token, uint256 amount, uint256 periodIndex) external nonReentrant {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Zero amount");
        require(periodIndex < FIXED_PERIODS.length, "Invalid period index");
        uint256 fee = (amount * FEE_PERCENT) / 100;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).safeTransfer(owner(), fee);
        uint256 lockId = _createLock(msg.sender, token, amount - fee, FIXED_PERIODS[periodIndex]);
        uint256 nftId  = IVaultNFT(nftContract).mint(msg.sender, lockId);
        nftToLock[nftId] = lockId;
        emit Deposited(lockId, msg.sender, token, amount - fee, _locks[lockId].unlockTime, nftId);
    }

    function withdraw(uint256 nftTokenId) external nonReentrant {
        uint256 lockId = nftToLock[nftTokenId];
        LockInfo storage lock = _locks[lockId];
        require(lock.owner == msg.sender, "Not your lock");
        require(!lock.withdrawn, "Already withdrawn");
        require(block.timestamp >= lock.unlockTime, "Still locked");
        lock.withdrawn = true;
        uint256 amount = lock.amount;
        IVaultNFT(nftContract).burn(nftTokenId);
        _sendAsset(lock.token, msg.sender, amount);
        emit Withdrawn(lockId, msg.sender, amount);
    }

    function earlyWithdraw(uint256 nftTokenId) external nonReentrant {
        uint256 lockId = nftToLock[nftTokenId];
        LockInfo storage lock = _locks[lockId];
        require(lock.owner == msg.sender, "Not your lock");
        require(!lock.withdrawn, "Already withdrawn");
        require(block.timestamp < lock.unlockTime, "Use withdraw() instead");
        lock.withdrawn = true;
        uint256 penalty = (lock.amount * EARLY_FEE_PERCENT) / 100;
        uint256 payout  = lock.amount - penalty;
        IVaultNFT(nftContract).burn(nftTokenId);
        _sendAsset(lock.token, owner(), penalty);
        _sendAsset(lock.token, msg.sender, payout);
        emit EarlyWithdrawn(lockId, msg.sender, payout, penalty);
    }

    function getLock(uint256 lockId) external view returns (LockInfo memory) { return _locks[lockId]; }
    function getUserLocks(address user) external view returns (uint256[] memory) { return _userLocks[user]; }
    function getFixedPeriods() external view returns (uint256[] memory) { return FIXED_PERIODS; }
    function isUnlocked(uint256 lockId) external view returns (bool) { return block.timestamp >= _locks[lockId].unlockTime; }

    function _createLock(address user, address token, uint256 amount, uint256 lockDays) internal returns (uint256 lockId) {
        lockId = _nextLockId++;
        _locks[lockId] = LockInfo(user, token, amount, block.timestamp, block.timestamp + lockDays * 1 days, false);
        _userLocks[user].push(lockId);
    }

    function _sendAsset(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "MON transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    receive() external payable {}
}
