import { ChainGrpcBankApi, ChainGrpcWasmApi, MsgExecuteContract, Msgs } from '@injectivelabs/sdk-ts'
import { IRepository } from './repository.interface'
import { Network, getNetworkEndpoints } from '@injectivelabs/networks'
import { encodedBase64 } from '@/utils/utils'
import { Persona, Wallet } from './types'
import { AddWalletMsg, RemoveWalletMsg } from '@/blockchain/smart-contract/inj-sc'
import { MsgBroadcaster, WalletStrategy } from '@injectivelabs/wallet-ts'
import { ChainId } from '@injectivelabs/ts-types'
import { Chain, ConnectedWallet } from '@/blockchain/types/connected-wallet'

export class InjectiveRepository<T> implements IRepository<T> {
  NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? Network.MainnetSentry : Network.TestnetSentry
  ENDPOINTS = getNetworkEndpoints(this.NETWORK)
  chainGrpcWasmApi = new ChainGrpcWasmApi(this.ENDPOINTS.grpc)
  chainGrpcBankApi = new ChainGrpcBankApi(this.ENDPOINTS.grpc)
  explorerEndpoint = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'https://explorer.injective.network' : 'https://testnet.explorer.injective.network'
  chainId = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? ChainId.Mainnet : ChainId.Testnet

  async getBalance(address: string): Promise<number> {
    const b = await this.chainGrpcBankApi.fetchBalance({
      accountAddress: address,
      denom: 'inj',
    })

    return Number((parseInt(b.amount) / Math.pow(10, 18)).toFixed(3))
  }

  async getPersonaFromWallet(address: string): Promise<Persona> {
    const query_raw = {
      get_persona: { address },
    }
    const query = encodedBase64(query_raw)
    const contractState = await this.chainGrpcWasmApi.fetchSmartContractState(process.env.NEXT_PUBLIC_INJ_SC!, query)
    const persona: Persona = JSON.parse(Buffer.from(contractState.data).toString())
    return persona
  }

  async getPersonasFromLinkedWallet(wallet: Wallet): Promise<Persona[]> {
    const query_raw = {
      get_persona_from_linked_wallet: { wallet },
    }
    const query = encodedBase64(query_raw)
    const contractState = await this.chainGrpcWasmApi.fetchSmartContractState(process.env.NEXT_PUBLIC_INJ_SC ?? '', query)
    let personas: Persona[] = JSON.parse(Buffer.from(contractState.data).toString())

    const updatedPersonas = personas
      .map((persona) => {
        return {
          ...persona,
          chain: Chain.Injective,
        }
      })
      .filter((persona) => persona.address !== wallet.address)

    return updatedPersonas
  }

  async addWallet(connectedWallet: ConnectedWallet, wallet: Wallet): Promise<{ txn: string; persona: Persona }> {
    const addPersonaMsg: AddWalletMsg = {
      add_wallet: {
        wallet,
      },
    }

    const msg = MsgExecuteContract.fromJSON({
      sender: connectedWallet.address,
      contractAddress: process.env.NEXT_PUBLIC_INJ_SC!,
      msg: addPersonaMsg,
    })

    const walletStrategy = new WalletStrategy({
      wallet: connectedWallet.provider as any,
      chainId: this.chainId,
    })

    const txn = await this.broadcastTransactionWindow(process.env.NEXT_PUBLIC_NETWORK === 'mainnet', walletStrategy, msg, connectedWallet.address)

    const persona = await this.getPersonaFromWallet(connectedWallet.address)

    return {
      txn: `${this.explorerEndpoint}/transaction/${txn.txHash}`,
      persona,
    }
  }

  async removeWallet(connectedWallet: ConnectedWallet, wallet: Wallet): Promise<{ txn: string; persona: Persona }> {
    const removeWalletMsg: RemoveWalletMsg = {
      remove_wallet: {
        wallet,
      },
    }
    const msg = MsgExecuteContract.fromJSON({
      sender: connectedWallet.address,
      contractAddress: process.env.NEXT_PUBLIC_INJ_SC!,
      msg: removeWalletMsg,
    })

    const walletStrategy = new WalletStrategy({
      wallet: connectedWallet.provider as any,
      chainId: ChainId.Mainnet,
    })

    const txn = await this.broadcastTransactionWindow(process.env.NEXT_PUBLIC_NETWORK === 'mainnet', walletStrategy, msg, connectedWallet.address)

    const persona = await this.getPersonaFromWallet(connectedWallet.address)

    return {
      txn: `${this.explorerEndpoint}/transaction/${txn.txHash}`,
      persona,
    }
  }

  async broadcastTransactionWindow(isMainnet: boolean, walletStrategy: WalletStrategy, msg: Msgs | Msgs[], sender: string, memo?: string) {
    const chainId = isMainnet ? ChainId.Mainnet : ChainId.Testnet

    const txn = await new MsgBroadcaster({
      walletStrategy,
      network: isMainnet ? Network.MainnetSentry : Network.TestnetSentry,
      simulateTx: false,
    }).broadcast({
      msgs: msg,
      injectiveAddress: sender,
      memo,
    })

    return txn
  }
}
