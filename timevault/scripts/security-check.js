import { readFileSync } from 'fs';

const tv = readFileSync('contracts/TimeVault.sol', 'utf8');
const nft = readFileSync('contracts/VaultNFT.sol', 'utf8');

console.log('\n' + '═'.repeat(55));
console.log('  TimeVault — Security Checklist');
console.log('═'.repeat(55));

const checks = [
  { name: 'ReentrancyGuard imported',           pass: tv.includes('ReentrancyGuard') },
  { name: 'nonReentrant pe deposit/withdraw',   pass: (tv.match(/nonReentrant/g) || []).length >= 6 },
  { name: 'CEI: withdrawn=true prima linie',    pass: tv.includes('lock.withdrawn = true;\n        uint256 amount') },
  { name: 'SafeERC20 folosit',                  pass: tv.includes('using SafeERC20') },
  { name: 'Pull-payment fees (accumulatedFees)',pass: tv.includes('accumulatedFees') },
  { name: 'NFT contract one-time lock',         pass: tv.includes('nftContractLocked') },
  { name: 'finalizeNFTContract() exista',       pass: tv.includes('finalizeNFTContract') },
  { name: 'onlyOwner pe setNFTContract',        pass: /setNFTContract[^{]*onlyOwner/.test(tv) },
  { name: 'onlyVault pe mint()',                pass: /function mint[^{]*onlyVault/.test(nft) },
  { name: 'onlyVault pe burn()',                pass: /function burn[^{]*onlyVault/.test(nft) },
  { name: 'Solidity 0.8.x overflow safe',      pass: tv.includes('pragma solidity ^0.8') },
  { name: 'MIN_LOCK_DAYS validare',             pass: tv.includes('MIN_LOCK_DAYS') },
  { name: 'MAX_LOCK_DAYS validare',             pass: tv.includes('MAX_LOCK_DAYS') },
  { name: 'require(msg.value > 0)',             pass: tv.includes('No MON sent') },
  { name: 'require(lock.owner == msg.sender)',  pass: tv.includes('Not your lock') },
];

let pass = 0, fail = 0;
checks.forEach(c => {
  const icon = c.pass ? '✅' : '❌';
  console.log(`  ${icon} ${c.name}`);
  c.pass ? pass++ : fail++;
});

console.log('\n' + '─'.repeat(55));
console.log(`  TRECUT: ${pass}/${checks.length}   PICAT: ${fail}/${checks.length}`);
if (fail === 0) {
  console.log('\n  ✅ GATA DE DEPLOY pe Monad Mainnet!');
} else {
  console.log('\n  ❌ Rezolva erorile inainte de deploy!');
}
console.log('═'.repeat(55) + '\n');
process.exit(fail > 0 ? 1 : 0);
