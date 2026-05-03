import { ethers } from 'ethers';
import { readFileSync } from 'fs';

const RPC_URL    = 'https://monad-mainnet.g.alchemy.com/v2/Uwb7T0DbXMQHjiJBNf9_b005qYjLmJqk';
const VAULT_ADDR = '0x653b0fF0d62c41DFF514D7543784e9F6426020aB';
const NFT_ADDR   = '0x1C905DE49797b33cc368FC9868aBb2cBa1178773';

const { VaultNFT: nftArtifact, TimeVault: vaultArtifact } = JSON.parse(readFileSync('artifacts/artifacts.json', 'utf8'));

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 143, name: 'monad-mainnet' });
  const vault = new ethers.Contract(VAULT_ADDR, vaultArtifact.abi, provider);
  const nft   = new ethers.Contract(NFT_ADDR,   nftArtifact.abi,   provider);

  console.log('\n' + '═'.repeat(55));
  console.log('  TimeVault — Function Check (live on Monad)');
  console.log('═'.repeat(55));

  const checks = [];

  async function check(label, fn) {
    try {
      const result = await fn();
      console.log(`  ✅ ${label}: ${result}`);
      checks.push(true);
    } catch(e) {
      console.log(`  ❌ ${label}: ${e.message.slice(0, 60)}`);
      checks.push(false);
    }
  }

  console.log('\n── TimeVault ─────────────────────────────────────────');
  await check('owner()',              () => vault.owner());
  await check('nftContract()',        () => vault.nftContract());
  await check('nftContractLocked()',  () => vault.nftContractLocked());
  await check('accumulatedFees()',    () => vault.accumulatedFees());
  await check('FEE_PERCENT()',        () => vault.FEE_PERCENT());
  await check('EARLY_FEE_PERCENT()', () => vault.EARLY_FEE_PERCENT());
  await check('MIN_LOCK_DAYS()',      () => vault.MIN_LOCK_DAYS());
  await check('MAX_LOCK_DAYS()',      () => vault.MAX_LOCK_DAYS());
  await check('getFixedPeriods()',    () => vault.getFixedPeriods());
  await check('getLock(0)',           () => vault.getLock(0).then(l => `owner=${l.owner.slice(0,10)}... amount=${l.amount}`));
  await check('isUnlocked(0)',        () => vault.isUnlocked(0));
  await check('nftToLock(0)',         () => vault.nftToLock(0));
  await check('getUserLocks(owner)',  () => vault.getUserLocks('0x592B35c8917eD36c39Ef73D0F5e92B0173560b2e').then(l => `[${l.join(',')}]`));

  console.log('\n── VaultNFT ──────────────────────────────────────────');
  await check('owner()',               () => nft.owner());
  await check('vaultContract()',       () => nft.vaultContract());
  await check('vaultContractLocked()', () => nft.vaultContractLocked());
  await check('name()',                () => nft.name());
  await check('symbol()',              () => nft.symbol());
  await check('tokenIdToLockId(0)',    () => nft.tokenIdToLockId(0));

  console.log('\n── Link Verification ─────────────────────────────────');
  const nftInVault  = await vault.nftContract();
  const vaultInNft  = await nft.vaultContract();
  const nftLocked   = await vault.nftContractLocked();
  const vaultLocked = await nft.vaultContractLocked();

  const link1 = nftInVault.toLowerCase() === NFT_ADDR.toLowerCase();
  const link2 = vaultInNft.toLowerCase() === VAULT_ADDR.toLowerCase();
  console.log(`  ${link1 ? '✅' : '❌'} vault.nftContract → NFT corect`);
  console.log(`  ${link2 ? '✅' : '❌'} nft.vaultContract → Vault corect`);
  console.log(`  ${nftLocked   ? '✅' : '❌'} nftContractLocked = ${nftLocked}`);
  console.log(`  ${vaultLocked ? '✅' : '❌'} vaultContractLocked = ${vaultLocked}`);

  const passed = checks.filter(Boolean).length;
  console.log('\n' + '─'.repeat(55));
  console.log(`  TRECUT: ${passed}/${checks.length}`);
  console.log(passed === checks.length ? '  ✅ TOATE FUNCTIILE OK!' : '  ⚠️  Unele functii au erori');
  console.log('═'.repeat(55) + '\n');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
