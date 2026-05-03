// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";

interface IDragon {
    function setDistributor(address _d) external;
    function transferOwnership(address newOwner) external;
}

contract DragonFixer {
    constructor(address dragon, address newStaking, address returnOwnerTo) {
        IDragon(dragon).setDistributor(newStaking);
        IDragon(dragon).transferOwnership(returnOwnerTo);
    }
}

contract FixFinal is Script {
    address constant DRAGON      = 0x1b685B0c771b877d1a4e8F02365a4A809E962c81;
    address constant NEW_STAKING = 0x611b5c38e51410e3d85F4d9Cba3C9c99B6fb85Fd;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        DragonFixer fixer = new DragonFixer(DRAGON, NEW_STAKING, NEW_STAKING);
        console.log("Fixer:", address(fixer));
        vm.stopBroadcast();
    }
}
