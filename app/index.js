const express = require('express');
const bodyParser = require('body-parser');
const Blockchain = require('../Blockchain');
const P2pServer = require('./p2p-server');
const wallet = require('../wallet');
const TransactionPool = require('../wallet/transaction-pool');
const Miner = require('./miner');
const path = require('path');
const HTTP_PORT = process.env.HTTP_PORT || 3001;

const app = express();
const blockchain = new Blockchain();
const Wallet = new wallet();
const tp = new TransactionPool();
const p2pServer = new P2pServer(blockchain, tp);
const miner = new Miner(blockchain, tp, Wallet, p2pServer);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('/api/blocks', (req, res) => {
	res.json(blockchain.chain);
});

app.get('/api/transactions', (req,res) => {
	res.json(tp.transactions);
});

app.get('/api/wallet-info', (req,res) => {
	res.json({ balance: Wallet.calculateBalance(blockchain), address: Wallet.publicKey });
});

app.get('/api/mine-transactions', (req,res) => {
	const block = miner.mine();
	if(block) {
		console.log(`New Block has been added: ${block.toString()}`);
		res.redirect('/api/blocks');
	} else {
		console.log("No new transactions to mine.");
		res.redirect('/api/blocks');
	}
});

app.get('/api/public-key', (req,res) => {
	res.json({ publicKey: Wallet.publicKey });
});

app.post('/api/mine', (req,res) => {
	const block = blockchain.addBlock(req.body.data);
	console.log(`New Block added: ${block.toString()}`);

	p2pServer.syncChains();

	res.redirect('/api/blocks');
});

app.post('/api/transact', (req,res) => {
	const { recipient, amount } = req.body;
	const transaction = Wallet.createTransaction(recipient, amount, blockchain, tp);
	p2pServer.broadcastTransaction(transaction);
	res.redirect('/api/transactions');
});

app.get('/api/known-addresses', (req,res) => {
	var addressMap = {};
	blockchain.chain.forEach(block => {
		if(block.data.length > 0) {
			block.data.forEach(transaction => {
				transaction.outputs.forEach(output => {
					addressMap[output.address] = output.address;
				});
			});
		}
	});
	res.json(Object.keys(addressMap));
});

app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname,'../client/dist/index.html'));
});

app.listen(HTTP_PORT,() => {
	console.log(`Listening for connections on port: ${HTTP_PORT}`);
});

p2pServer.listen();


