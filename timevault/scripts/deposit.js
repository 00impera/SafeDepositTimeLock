import { ethers } from 'ethers';
import { readFileSync } from 'fs';

const RPC_URL    = 'https://monad-mainnet.g.alchemy.com/v2/Uwb7T0DbXMQHjiJBNf9_b005qYjLmJqk';
const VAULT_ADDR = '0x653b0fF0d62c41DFF514D7543784e9F6426020aB';

const { TimeVault: vaultArtifact } = JSON.parse(readFileSync('artifacts/artifacts.json', 'utf8'));

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) { console.error('❌ Set PRIVATE_KEY'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 143, name: 'monad-mainnet' });
  const wallet   = new ethers.Wallet(pk, provider);
  const vault    = new ethers.Contract(VAULT_ADDR, vaultArtifact.abi, wallet);

  const amount   = ethers.parseEther('1');
  const lockDays = 30;

  console.log('\n' + '═'.repeat(55));
  console.log('  TimeVault — Deposit MON');
  console.log('═'.repeat(55));
  console.log(`  Wallet:   ${wallet.address}`);
  console.log(`  Amount:   1 MON`);
  console.log(`  Lock:     ${lockDays} zile`);
  console.log(`  Fee 2%:   0.02 MON`);
  console.log(`  Blocat:   0.98 MON`);

  const tx = await vault.depositMON(lockDays, { value: amount });
  console.log(`\n  TX: ${tx.hash}`);
  process.stdout.write('  ⏳ Confirmare...');

  const receipt = await tx.wait();
  console.log(' ✅');

  // Extrage event Deposited
  const iface = new ethers.Interface(vaultArtifact.abi);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === 'Deposited') {
        const unlockDate = new Date(Number(parsed.args.unlockTime) * 1000).toLocaleDateString('ro-RO');
        console.log('\n' + '─'.repeat(55));
        console.log(`  ✅ DEPOSIT REUSIT!`);
        console.log(`  Lock ID:    ${parsed.args.lockId}`);
        console.log(`  NFT ID:     ${parsed.args.nftTokenId}`);
        console.log(`  Amount:     ${ethers.formatEther(parsed.args.amount)} MON`);
        console.log(`  Unlock:     ${unlockDate}`);
        console.log(`  Explorer:   https://explorer.monad.xyz/tx/${tx.hash}`);
        console.log('═'.repeat(55) + '\n');
      }
    } catch {}
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
