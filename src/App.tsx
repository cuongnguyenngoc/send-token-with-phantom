// @ts-nocheck
import { WalletAdapterNetwork, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import * as web3 from '@solana/web3.js';
import { toast,ToastContainer } from "react-toastify";

import {getOrCreateAssociatedTokenAccount,createTransferInstruction,TOKEN_PROGRAM_ID} from "@solana/spl-token"; // @ts-nocheck

import '../src/css/bootstrap.css'
import {
  GlowWalletAdapter,
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  SolletExtensionWalletAdapter,
  SolletWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';

import { clusterApiUrl, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { FC, ReactNode, useMemo, useCallback, useState } from 'react';

import { Connection } from '@metaplex/js';
import axios from 'axios';

require('./App.css');
require('@solana/wallet-adapter-react-ui/styles.css');
require('react-toastify/dist/ReactToastify.css');

const theWallet = "8QEz51cud4EUjyd2tY3BfHvxWLPaXrVfdmjJqz9Hb432"

const App: FC = () => {
  return (
    <Context>
      <Content />
    </Context>
  );
};


export default App;

const Context: FC<{ children: ReactNode }> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Mainnet;

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking and lazy loading --
  // Only the wallets you configure here will be compiled into your application, and only the dependencies
  // of wallets that your users connect to will be loaded.
  const wallets = useMemo(
    () => [
      new LedgerWalletAdapter(),
      new PhantomWalletAdapter(),
      new GlowWalletAdapter(),
      new SlopeWalletAdapter(),
      new SolletExtensionWalletAdapter(),
      new SolletWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new TorusWalletAdapter(),
    ],
    [network]
  );



  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

const Content: FC =  () => {
  let [igsNum, setIgsNum] = useState("1");
  let [sIgsInv, setSIgsInv] = useState(0);
  
  axios.get("http://10.5.1.51:34572/inventory/540004719935094795")
  .then(res=> setSIgsInv(res.data.sIgsAmount));
   

  // const { connection } = useConnection();
  const connection = new Connection(clusterApiUrl(WalletAdapterNetwork.Mainnet))
  const { publicKey, sendTransaction, signTransaction } = useWallet();

  const igs = new web3.PublicKey("igsvRjB6uyVMGcM9nbWwESxN1eTfVTPiQ1ThoCc8f2g");
  const toWalletPubKey = new web3.PublicKey(theWallet);

  const onClick = useCallback(async () => {

    if (!publicKey) throw new WalletNotConnectedError();
    connection.getBalance(publicKey).then((bal) => {
      console.log(bal / LAMPORTS_PER_SOL);
    });
    console.log("publicKey",publicKey);

    // Get the token account of the fromWallet address, and if it does not exist, create it
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      publicKey,
      igs,
      publicKey,
      signTransaction
    );
    console.log("fromTokenAccount",fromTokenAccount.address)

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      publicKey,
      igs,
      toWalletPubKey,
      signTransaction
    );
    console.log("toTokenAccount",toTokenAccount.address)

    console.log("igsNum",igsNum);
    const transaction = new Transaction().add(
      createTransferInstruction(
        fromTokenAccount.address, // source
        toTokenAccount.address, // dest
        publicKey,
        Number(igsNum),
        [],
        TOKEN_PROGRAM_ID
      )
    )

    const blockHash = await connection.getRecentBlockhash()
    transaction.feePayer = await publicKey;
    console.log("transaction.feePayer",transaction.feePayer)
    transaction.recentBlockhash = await blockHash.blockhash
    const signed = await signTransaction(transaction) // @ts-nocheck 
    console.log("signed",signed)

    const signature = await connection.sendRawTransaction(signed.serialize())
    console.log('transaction sent', signature);
    toast.success('transaction sent', signature);

    await connection.confirmTransaction(signature, 'finalized');
    console.log('transaction sent', signature);
    toast.success("confirmed transaction");

    try {
      await axios.post("http://10.5.1.51:34572/bridge/in", {
        transactionSignature: signature
      });

      await axios.get("http://10.5.1.51:34572/inventory/540004719935094795")
      .then(res=> setSIgsInv(res.data.sIgsAmount));

      toast.success(`${igsNum} sIGS has been exchanged by ${igsNum} IGS`);
    } catch(err) {
      console.log('err', err?.response?.data?.err?.msg);
      toast.error(err?.response?.data?.err?.msg)
    }
  }, [publicKey, sendTransaction, connection]);

  return (
    <div className="App">
      <div className="navbar">
        <div className="navbar-inner ">
          <a id="title" className="brand" href="#">Send IGS to 8QEz51cud4EUjyd2tY3BfHvxWLPaXrVfdmjJqz9Hb432 to buy sIGS</a>
          <ul className="nav">
          </ul>
          <h4>User current sIGS: {sIgsInv}</h4>
          <ul className="nav"></ul>
          <ul className="nav pull-right">
            <li className="divider-vertical"></li>
            <li><WalletMultiButton /></li>

          </ul>
        </div>
      </div>
      <input value={igsNum} type="number" onChange={(e) => setIgsNum(e.target.value)}></input>
      <br></br>
      <button className='btn' onClick={onClick}>
        Buy sIGS by IGS
        </button>
        <ToastContainer />
    </div>
  );
};
