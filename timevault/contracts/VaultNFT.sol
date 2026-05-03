// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface ITimeVaultView {
    struct LockInfo {
        address owner;
        address token;
        uint256 amount;
        uint256 lockedAt;
        uint256 unlockTime;
        bool withdrawn;
    }
    function getLock(uint256 lockId) external view returns (LockInfo memory);
}

contract VaultNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 private _nextTokenId;
    address public vaultContract;
    bool public vaultContractLocked;
    mapping(uint256 => uint256) public tokenIdToLockId;

    modifier onlyVault() {
        require(msg.sender == vaultContract, "Only vault");
        _;
    }

    constructor(address initialOwner)
        ERC721("TimeVault Lock", "TVLOCK")
        Ownable(initialOwner) {}

    function setVaultContract(address vault) external onlyOwner {
        require(!vaultContractLocked, "Already finalized");
        require(vault != address(0), "Zero address");
        vaultContract = vault;
    }

    function finalizeVaultContract() external onlyOwner {
        require(vaultContract != address(0), "Not set");
        vaultContractLocked = true;
    }

    function mint(address to, uint256 lockId) external onlyVault returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        tokenIdToLockId[tokenId] = lockId;
        _mint(to, tokenId);
        return tokenId;
    }

    function burn(uint256 tokenId) external onlyVault {
        _burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint256 lockId = tokenIdToLockId[tokenId];
        ITimeVaultView.LockInfo memory lock = ITimeVaultView(vaultContract).getLock(lockId);

        bool unlocked = block.timestamp >= lock.unlockTime;
        string memory status = lock.withdrawn ? "Withdrawn" : (unlocked ? "Unlocked" : "Locked");

        string memory svg = _buildSVG(lock, unlocked, lock.withdrawn, tokenId);
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"TimeVault #', tokenId.toString(),
            '","description":"Time-locked vault NFT on Monad","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[',
            '{"trait_type":"Status","value":"', status, '"},',
            '{"trait_type":"Amount","value":"', _fmtAmt(lock.amount), '"},',
            '{"trait_type":"Token","value":"', lock.token == address(0) ? "MON" : "ERC20", '"},',
            '{"trait_type":"Unlock Time","value":"', lock.unlockTime.toString(), '"}',
            ']}'
        ))));
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _buildSVG(ITimeVaultView.LockInfo memory lock, bool unlocked, bool withdrawn, uint256 tokenId) internal view returns (string memory) {
        string memory borderCol = withdrawn ? "#444" : "#C8960C";
        string memory accentCol = withdrawn ? "#555" : (unlocked ? "#FFD700" : "#39FF14");
        string memory statusTxt = withdrawn ? "WITHDRAWN" : (unlocked ? "UNLOCKED" : "LOCKED");

        uint256 dd; uint256 hh; uint256 mm; uint256 ss;
        if (!unlocked && !withdrawn && block.timestamp < lock.unlockTime) {
            uint256 rem = lock.unlockTime - block.timestamp;
            dd = rem / 86400; hh = (rem % 86400) / 3600;
            mm = (rem % 3600) / 60; ss = rem % 60;
        }

        uint256 pct = 0;
        if (lock.unlockTime > lock.lockedAt) {
            uint256 total = lock.unlockTime - lock.lockedAt;
            uint256 elapsed = block.timestamp > lock.lockedAt ? block.timestamp - lock.lockedAt : 0;
            if (elapsed >= total) pct = 100;
            else pct = elapsed * 100 / total;
        }

        return string(abi.encodePacked(
            '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">',
            '<rect width="400" height="300" rx="16" fill="#050A0E"/>',
            '<rect x="1.5" y="1.5" width="397" height="297" rx="15" fill="none" stroke="', borderCol, '" stroke-width="1.5"/>',
            '<text x="20" y="34" fill="', borderCol, '" font-size="11" font-family="monospace">TIMEVAULT #', tokenId.toString(), '</text>',
            '<text x="380" y="34" text-anchor="end" fill="', accentCol, '" font-size="11" font-family="monospace">', statusTxt, '</text>',
            '<line x1="20" y1="44" x2="380" y2="44" stroke="', borderCol, '" stroke-width="0.5" opacity="0.5"/>',
            '<text x="20" y="70" fill="#888" font-size="10" font-family="monospace">AMOUNT</text>',
            '<text x="20" y="98" fill="#FFD700" font-size="28" font-family="monospace" font-weight="bold">', _fmtAmt(lock.amount), '</text>',
            '<text x="20" y="128" fill="#888" font-size="10" font-family="monospace">COUNTDOWN</text>',
            '<text x="20" y="158" fill="', accentCol, '" font-size="24" font-family="monospace" font-weight="bold">',
            _pad(dd), 'd ', _pad(hh), 'h ', _pad(mm), 'm ', _pad(ss), 's',
            '</text>',
            '<rect x="20" y="185" width="360" height="8" rx="4" fill="#111"/>',
            '<rect x="20" y="185" width="', (pct * 360 / 100).toString(), '" height="8" rx="4" fill="', accentCol, '"/>',
            '<text x="200" y="212" text-anchor="middle" fill="#555" font-size="10" font-family="monospace">', pct.toString(), '% elapsed</text>',
            '<line x1="20" y1="240" x2="380" y2="240" stroke="', borderCol, '" stroke-width="0.5" opacity="0.3"/>',
            '<text x="20" y="260" fill="#333" font-size="9" font-family="monospace">MONAD MAINNET</text>',
            '<text x="380" y="260" text-anchor="end" fill="#333" font-size="9" font-family="monospace">TimeVault v1.0</text>',
            '</svg>'
        ));
    }

    function _pad(uint256 n) internal pure returns (string memory) {
        if (n < 10) return string(abi.encodePacked("0", n.toString()));
        return n.toString();
    }

    function _fmtAmt(uint256 amount) internal pure returns (string memory) {
        uint256 whole = amount / 1e18;
        uint256 frac = (amount % 1e18) / 1e14;
        return string(abi.encodePacked(whole.toString(), ".", _padFrac(frac)));
    }

    function _padFrac(uint256 n) internal pure returns (string memory) {
        if (n < 10)   return string(abi.encodePacked("000", n.toString()));
        if (n < 100)  return string(abi.encodePacked("00",  n.toString()));
        if (n < 1000) return string(abi.encodePacked("0",   n.toString()));
        return n.toString();
    }
}
