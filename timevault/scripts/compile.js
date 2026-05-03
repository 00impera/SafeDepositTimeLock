import { createRequire } from 'module';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const solc = require('solc');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OZ = resolve(__dirname, '../node_modules/@openzeppelin/contracts');

function findImports(importPath) {
  try {
    if (importPath.startsWith('@openzeppelin/contracts/')) {
      const local = importPath.replace('@openzeppelin/contracts/', OZ + '/');
      return { contents: readFileSync(local, 'utf8') };
    }
    return { contents: readFileSync('contracts/' + importPath, 'utf8') };
  } catch(e) {
    return { error: 'File not found: ' + importPath };
  }
}

const contractFiles = ['IVaultNFT.sol', 'VaultNFT.sol', 'TimeVault.sol'];
const sources = {};
contractFiles.forEach(f => {
  sources[f] = { content: readFileSync('contracts/' + f, 'utf8') };
});

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
  }
};

console.log('🔨 Compiling with solc', solc.version(), '(EVM: cancun, viaIR: true)...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

let hasErrors = false;
if (output.errors) {
  output.errors.forEach(e => {
    if (e.severity === 'error') {
      console.log('❌', e.formattedMessage.split('\n')[0]);
      hasErrors = true;
    } else if (!e.message.includes('SPDX')) {
      console.log('⚠️ ', e.formattedMessage.split('\n')[0]);
    }
  });
}

if (hasErrors) { console.log('\n❌ Compilation failed'); process.exit(1); }

const artifacts = {};
['VaultNFT', 'TimeVault'].forEach(name => {
  const c = output.contracts[name + '.sol'][name];
  artifacts[name] = { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
  const size = Math.round(c.evm.bytecode.object.length / 2);
  const limit = 24576;
  const pct = Math.round(size / limit * 100);
  const icon = size > limit ? '❌' : (size > 20000 ? '⚠️ ' : '✅');
  console.log(`${icon} ${name}: ${c.abi.length} funcs | ${size.toLocaleString()} bytes (${pct}% of 24KB limit)`);
});

mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/artifacts.json', JSON.stringify(artifacts, null, 2));
console.log('\n✅ Compilat cu succes → artifacts/artifacts.json');
