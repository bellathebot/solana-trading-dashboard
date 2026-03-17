export default async function handler(req, res) {
  var checks = {
    nodeVersion: process.version,
    hasWallet: Boolean(process.env.WALLET_ADDRESS),
    hasHelius: Boolean(process.env.HELIUS_API_KEY),
    walletPreview: (process.env.WALLET_ADDRESS || '').slice(0, 8),
    envKeys: Object.keys(process.env).filter(function(k) {
      return k.indexOf('WALLET') !== -1 || k.indexOf('HELIUS') !== -1 || k.indexOf('INITIAL') !== -1;
    }),
    timestamp: new Date().toISOString()
  };

  try {
    var testRes = await fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112');
    var testData = await testRes.json();
    checks.jupiterApi = 'ok';
    checks.solPrice = testData['So11111111111111111111111111111111111111112']?.usdPrice || 'missing';
  } catch (e) {
    checks.jupiterApi = 'error: ' + e.message;
  }

  if (process.env.HELIUS_API_KEY) {
    try {
      var rpcRes = await fetch('https://mainnet.helius-rpc.com/?api-key=' + process.env.HELIUS_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [process.env.WALLET_ADDRESS || 'So11111111111111111111111111111111111111112'] })
      });
      var rpcData = await rpcRes.json();
      checks.heliusRpc = rpcData.error ? 'rpc error: ' + JSON.stringify(rpcData.error) : 'ok';
      checks.balance = rpcData.result?.value;
    } catch (e) {
      checks.heliusRpc = 'error: ' + e.message;
    }
  }

  return res.status(200).json(checks);
}
