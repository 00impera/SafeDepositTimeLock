// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DragonToken is ERC20, Ownable {
    address public distributor;
    string private _logoURI;

    constructor(uint256 initialSupply) ERC20("Dragon", "DRAGON") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    function setDistributor(address _distributor) external onlyOwner {
        distributor = _distributor;
    }

    function mintRewards(address to, uint256 amount) external {
        require(msg.sender == distributor, "Not distributor");
        _mint(to, amount);
    }

    function logoURI() external view returns (string memory) {
        return _logoURI;
    }

    function setLogoURI(string calldata uri) external onlyOwner {
        _logoURI = uri;
    }
}
