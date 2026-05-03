// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "../src/LiquidStaking.sol";
import "../src/GoldToken.sol";

interface IDragon {
    function setDistributor(address _d) external;
    function transferOwnership(address newOwner) external;
}

interface IRescueVechi {
    // Rescue vechi 0x5768 are functia hardcodata 0x1fbe1979
    // care apeleaza setDistributor pe DRAGON prin OLD_STAKING
    // Dar OLD_STAKING nu poate face asta...
}

contract Deploy is Script {
    address constant OWNER    = 0x592B35c8917eD36c39Ef73D0F5e92B0173560b2e;
    address constant DRAGON   = 0x1b685B0c771b877d1a4e8F02365a4A809E962c81;
    address constant TREASURY = 0x592B35c8917eD36c39Ef73D0F5e92B0173560b2e;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        GoldToken gold = new GoldToken(OWNER);
        LiquidStaking staking = new LiquidStaking(
            OWNER, address(gold), DRAGON, TREASURY
        );
        gold.transferOwnership(address(staking));

        console.log("GOLD_NEW    :", address(gold));
        console.log("STAKING_NEW :", address(staking));
        console.log("Acum apeleaza transferDragonOwnership pe OLD_STAKING!");

        vm.stopBroadcast();
    }
}
