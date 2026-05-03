import { readFileSync, writeFileSync } from 'fs';
import { ethers } from 'ethers';

const RPC_URL  = 'https://monad-mainnet.g.alchemy.com/v2/Uwb7T0DbXMQHjiJBNf9_b005qYjLmJqk';
const OWNER    = '0x592B35c8917eD36c39Ef73D0F5e92B0173560b2e';
const CHAIN_ID = 143;

const { VaultNFT: nftArtifact, TimeVault: vaultArtifact } = JSON.parse(readFileSync('artifacts/artifacts.json', 'utf8'));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitTx(provider, hash, label) {
  process.stdout.write(`  ⏳ ${label}...`);
  let receipt = null;
  while (!receipt) {
    receipt = await provider.getTransactionReceipt(hash).catch(() => null);
    if (!receipt) { process.stdout.write('.'); await sleep(2000); }
  }
  if (receipt.status !== 1) throw new Error(`TX failed: ${hash}`);
  console.log(' ✅');
  return receipt;
}

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) { console.error('❌ Set PRIVATE_KEY env var'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: 'monad-mainnet' });
  const wallet = new ethers.Wallet(pk, provider);

  console.log('\n' + '═'.repeat(55));
  console.log('  TimeVault Protocol — Deploy Monad Mainnet');
  console.log('═'.repeat(55));
  console.log(`\n📍 Deployer: ${wallet.address}`);
  console.log(`👑 Owner:    ${OWNER}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} MON`);
  if (balance < ethers.parseEther('0.05')) {
    console.error('❌ Insufficient balance! Need at least 0.05 MON for gas.');
    process.exit(1);
  }

  const feeData = await provider.getFeeData();
  console.log(`⛽ Gas:      ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei\n`);

  // 1. Deploy VaultNFT
  console.log('━'.repeat(55));
  console.log('[1/4] Deploy VaultNFT...');
  const nftFactory = new ethers.ContractFactory(nftArtifact.abi, nftArtifact.bytecode, wallet);
  const nftTx = await nftFactory.getDeployTransaction(OWNER);
  const nftGas = await provider.estimateGas({ ...nftTx, from: wallet.address });
  console.log(`  Gas estimat: ${nftGas.toLocaleString()}`);
  const nftSent = await wallet.sendTransaction({ ...nftTx, gasLimit: nftGas * 130n / 100n });
  console.log(`  TX: ${nftSent.hash}`);
  const nftReceipt = await waitTx(provider, nftSent.hash, 'VaultNFT deploy');
  const nftAddress = nftReceipt.contractAddress;
  console.log(`  📦 VaultNFT: ${nftAddress}`);

  // 2. Deploy TimeVault
  console.log('\n' + '━'.repeat(55));
  console.log('[2/4] Deploy TimeVault...');
  const vaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
  const vaultTx = await vaultFactory.getDeployTransaction(OWNER);
  const vaultGas = await provider.estimateGas({ ...vaultTx, from: wallet.address });
  console.log(`  Gas estimat: ${vaultGas.toLocaleString()}`);
  const vaultSent = await wallet.sendTransaction({ ...vaultTx, gasLimit: vaultGas * 130n / 100n });
  console.log(`  TX: ${vaultSent.hash}`);
  const vaultReceipt = await waitTx(provider, vaultSent.hash, 'TimeVault deploy');
  const vaultAddress = vaultReceipt.contractAddress;
  console.log(`  📦 TimeVault: ${vaultAddress}`);

  // 3. Link + Finalize
  console.log('\n' + '━'.repeat(55));
  console.log('[3/4] Link si finalize contracte...');

  const isOwner = wallet.address.toLowerCase() === OWNER.toLowerCase();

  if (isOwner) {
    const vault = new ethers.Contract(vaultAddress, vaultArtifact.abi, wallet);
    const nft   = new ethers.Contract(nftAddress,   nftArtifact.abi,   wallet);

    const tx1 = await vault.setNFTContract(nftAddress);
    console.log(`  setNFTContract TX: ${tx1.hash}`);
    await waitTx(provider, tx1.hash, 'setNFTContract');

    const tx2 = await nft.setVaultContract(vaultAddress);
    console.log(`  setVaultContract TX: ${tx2.hash}`);
    await waitTx(provider, tx2.hash, 'setVaultContract');

    const tx3 = await vault.finalizeNFTContract();
    console.log(`  finalizeNFTContract TX: ${tx3.hash}`);
    await waitTx(provider, tx3.hash, 'finalizeNFTContract');

    const tx4 = await nft.finalizeVaultContract();
    console.log(`  finalizeVaultContract TX: ${tx4.hash}`);
    await waitTx(provider, tx4.hash, 'finalizeVaultContract');

    console.log('  ✅ Linkate si finalizate!');
  } else {
    console.log(`  ⚠️  Deployer ≠ Owner. Trimite manual din ${OWNER}:`);
    console.log(`  1. vault.setNFTContract("${nftAddress}") → pe ${vaultAddress}`);
    console.log(`  2. nft.setVaultContract("${vaultAddress}") → pe ${nftAddress}`);
    console.log(`  3. vault.finalizeNFTContract() → pe ${vaultAddress}`);
    console.log(`  4. nft.finalizeVaultContract() → pe ${nftAddress}`);
  }

  // 4. Verificare
  console.log('\n' + '━'.repeat(55));
  console.log('[4/4] Verificare post-deploy...');
  const vault = new ethers.Contract(vaultAddress, vaultArtifact.abi, provider);
  const nft   = new ethers.Contract(nftAddress,   nftArtifact.abi,   provider);

  const vaultOwner = await vault.owner();
  const nftAddr    = await vault.nftContract().catch(() => 'N/A');
  const vaultAddr  = await nft.vaultContract().catch(() => 'N/A');
  const nftLocked  = await vault.nftContractLocked().catch(() => false);

  console.log(`  vault.owner():       ${vaultOwner}`);
  console.log(`  vault.nftContract(): ${nftAddr}`);
  console.log(`  nft.vaultContract(): ${vaultAddr}`);
  console.log(`  nftContractLocked:   ${nftLocked}`);

  const ownerOk  = vaultOwner.toLowerCase() === OWNER.toLowerCase();
  const linkedOk = nftAddr.toLowerCase() === nftAddress.toLowerCase();
  console.log(`\n  Owner OK:  ${ownerOk ? '✅' : '❌'}`);
  console.log(`  Linked OK: ${linkedOk ? '✅' : '⚠️  link manual'}`);
  console.log(`  Locked:    ${nftLocked ? '✅' : '⚠️  finalizeaza manual'}`);

  const result = {
    network: 'monad-mainnet', chainId: CHAIN_ID,
    deployedAt: new Date().toISOString(),
    deployer: wallet.address, owner: OWNER,
    contracts: {
      VaultNFT:  { address: nftAddress,   txHash: nftSent.hash,   gasUsed: nftReceipt.gasUsed.toString() },
      TimeVault: { address: vaultAddress, txHash: vaultSent.hash, gasUsed: vaultReceipt.gasUsed.toString() }
    }
  };
  writeFileSync('deployment.json', JSON.stringify(result, null, 2));

  console.log('\n' + '═'.repeat(55));
  console.log('  ✅ DEPLOY COMPLET!');
  console.log('═'.repeat(55));
  console.log(`\n  VaultNFT:  ${nftAddress}`);
  console.log(`  TimeVault: ${vaultAddress}`);
  console.log(`\n  🔗 Explorer:`);
  console.log(`     https://explorer.monad.xyz/address/${vaultAddress}`);
  console.log(`     https://explorer.monad.xyz/address/${nftAddress}`);
  console.log(`\n  📄 Salvat: deployment.json`);
}

main().catch(err => {
  console.error('\n❌ Deploy eșuat:', err.message);
  process.exit(1);
});
