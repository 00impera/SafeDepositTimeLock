// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVaultNFT {
    function mint(address to, uint256 lockId) external returns (uint256);
    function burn(uint256 tokenId) external;
}
