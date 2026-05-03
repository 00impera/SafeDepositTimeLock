// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import "../src/Rescue.sol";

contract DeployRescue is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        Rescue r = new Rescue();
        console.log("Rescue:", address(r));
        vm.stopBroadcast();
    }
}
