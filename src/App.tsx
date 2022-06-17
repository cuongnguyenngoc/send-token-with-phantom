// @ts-nocheck
import { WalletAdapterNetwork, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import * as web3 from '@solana/web3.js';
import { toast,ToastContainer } from "react-toastify";

// import {getOrCreateAssociatedTokenAccount,createTransferInstruction,TOKEN_PROGRAM_ID} from "@solana/spl-token"; // @ts-nocheck
import {Token,TOKEN_PROGRAM_ID} from "@solana/spl-token";
import '../src/css/bootstrap.css'
import {
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  SolletExtensionWalletAdapter,
  SolletWalletAdapter,
} from '@solana/wallet-adapter-wallets';

import { clusterApiUrl, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { FC, ReactNode, useMemo, useCallback, useState } from 'react';

import { Connection } from '@metaplex/js';
import axios from 'axios';

require('./App.css');
require('@solana/wallet-adapter-react-ui/styles.css');
require('react-toastify/dist/ReactToastify.css');

const theWallet = "AVKW5Dr3CtuiWDnAYLTEmkRNPNxsCNER62TctxmgTMat"

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
      new PhantomWalletAdapter(),
      new SlopeWalletAdapter(),
      new SolletExtensionWalletAdapter(),
      new SolletWalletAdapter(),
      new SolflareWalletAdapter({ network }),
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

    const token = new Token(connection, igs, TOKEN_PROGRAM_ID, signTransaction);
    const fromTokenAccount = await token.getOrCreateAssociatedAccountInfo(publicKey)

    // Get the derived address of the destination wallet which will hold the custom token
    const associatedDestTokenAddr = await Token.getAssociatedTokenAddress(
      token.associatedProgramId,
      token.programId,
      igs,
      toWalletPubKey
    );

    const receiverAccount = await connection.getAccountInfo(associatedDestTokenAddr);
    if (receiverAccount === null) {
      instructions.push(
        Token.createAssociatedTokenAccountInstruction(
          token.associatedProgramId,
          token.programId,
          igs,
          associatedDestTokenAddr,
          toWalletPubKey,
          publicKey // sender need to pay this too
        )
      )
    }

    instructions.push(
      Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          fromTokenAccount.address,
          associatedDestTokenAddr,
          publicKey,
          [],
          Number(igsNum)
      )
    )
    const transaction = new web3.Transaction().add(...instructions);

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
