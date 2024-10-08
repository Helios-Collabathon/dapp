'use client'
import { useContext, useEffect, useMemo, useState } from 'react'
import { Persona, Wallet } from '@/repository/types'
import { VerificationService } from '@/repository/verification.service'
import LinkedWalletTable from './components/linkedwallet.table'
import PendingLinkedWalletTable from './components/pendingverification.table'
import { PersonaService } from '@/repository/persona.service'
import { Chain, ChainUtils, ConnectedWallet } from '@/blockchain/types/connected-wallet'
import LinkedWalletTableSkeleton from './components/linkedwallet.skeleton'
import PendingLinkedWalletTableSkeleton from './components/pendingverification.skeleton'
import toast from 'react-hot-toast'
import { WalletContext } from '@/blockchain/wallet-provider'
import { useTrackTransactionStatus } from '@multiversx/sdk-dapp/hooks'
import axios from 'axios'
import Image from 'next/image'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSyncAlt } from '@fortawesome/free-solid-svg-icons'

export default function PersonaPage() {
  const { connectedWallet } = useContext(WalletContext)
  const [persona, setPersona] = useState<Persona | null>(null)
  const [pendingPersonas, setPendingPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(false)
  const [txn, setTxn] = useState('')
  const [injBalance, setInjBalance] = useState({ coin: 0, usdt: 0 })
  const [mvxBalance, setMvxBalance] = useState({ coin: 0, usdt: 0 })
  const [injUsdtPrice, setInjUsdtPrice] = useState(0)
  const [mvxUsdtPrice, setMvxUsdtPrce] = useState(0)
  const personaService = useMemo(() => new PersonaService(), [])
  const verificationService = useMemo(() => new VerificationService(), [])
  const isMobile = window.screen.width <= 768

  useTrackTransactionStatus({
    transactionId: txn,
    onSuccess: async () => {
      const updatePersona = await fetchAndVerifyPersona(connectedWallet)
      if (updatePersona) setPersona(updatePersona)
    },
    onFail: () => setTxn(''),
  })

  useEffect(() => {
    if (!connectedWallet?.address) return

    fetchAndVerifyPersona(connectedWallet).then(async (persona) => {
      const { injP, mvxP } = await getUsdtPrices()
      await getBalances(persona!, injP, mvxP)
    })
  }, [connectedWallet])

  const fetchAndVerifyPersona = async (connectedWallet: ConnectedWallet) => {
    try {
      setLoading(true)
      const fetchedPersona = await personaService.getPersonaByWallet(connectedWallet.address, connectedWallet.chain)

      if (fetchedPersona) {
        const verifiedPersona = await verificationService.verifyPersonaLinkedWallets(connectedWallet.address, fetchedPersona)

        const pendingLinks = await fetchPendingLinks(connectedWallet, fetchedPersona)

        verifiedPersona.linked_wallets = verifiedPersona.linked_wallets.sort((a, b) => Number(a) - Number(b))
        setPersona(verifiedPersona)
        setPendingPersonas(pendingLinks)
        return verifiedPersona
      } else return undefined
    } catch (error) {
      toast.error(`Error fetching or verifying persona!\n${error}`)
      return undefined
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingLinks = async (connectedWallet: ConnectedWallet, prsn?: Persona | undefined): Promise<Persona[]> => {
    try {
      if (!prsn) return []
      let personas = await personaService.getPersonasFromLinkedWallet({
        address: connectedWallet.address,
        chain: connectedWallet.chain,
      })

      personas = personas.filter((p) => {
        return !prsn.linked_wallets.some((wlt) => wlt.address === p.address)
      })

      return personas
    } catch (error) {
      toast.error(`Error fetching pending links! \n${error}`)
      return []
    }
  }

  const registerWallet = async (walletToAdd: Wallet) => {
    if (!connectedWallet?.address) {
      toast.error('Wallet not connected')
      return
    }

    try {
      setLoading(true)
      let { txn, persona } = await personaService.addWallet(connectedWallet, walletToAdd)

      const updatePersona = await fetchAndVerifyPersona(connectedWallet)

      if (updatePersona) persona = updatePersona
      setPersona(persona)
      setTxn(txn)
      return persona
    } catch (error) {
      toast.error(`Error registering wallet!\n${error}`)
    } finally {
      setLoading(false)
    }
  }

  const removeWallet = async (walletToRemove: Wallet) => {
    if (!connectedWallet?.address) {
      toast.error('Wallet not connected')
      return
    }

    try {
      setLoading(true)
      let { txn, persona } = await personaService.removeWallet(connectedWallet, walletToRemove)
      const updatePersona = await fetchAndVerifyPersona(connectedWallet)

      if (updatePersona) persona = updatePersona
      setPersona(persona)
      setTxn(txn)
      return persona
    } catch (error) {
      toast.error(`Error removing wallet!\n${error}`)
    } finally {
      setLoading(false)
    }
  }

  const getUsdtPrices = async () => {
    const inj_usdt_resp = (await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=INJUSDT')).data.price
    const mvx_usdt_resp = (await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=EGLDUSDT')).data.price

    setInjUsdtPrice(Number(inj_usdt_resp))
    setInjUsdtPrice(Number(mvx_usdt_resp))
    return { injP: Number(inj_usdt_resp), mvxP: Number(mvx_usdt_resp) }
  }

  const fetchINJBalance = async (prsn: Persona | undefined) => {
    if (!prsn) return
    let _injBalance = 0
    for (const wallet of prsn?.linked_wallets.filter((wallet) => wallet.chain === Chain.Injective)) {
      if (!wallet.verified) continue
      const inj_toadd = await personaService.getBalance(wallet.address!, wallet.chain!)
      _injBalance += inj_toadd
    }

    if (connectedWallet.chain === Chain.Injective) _injBalance += await personaService.getBalance(connectedWallet.address, connectedWallet.chain)
    return _injBalance
  }

  const fetchMVXBalance = async (prsn: Persona | undefined) => {
    if (!prsn) return
    let _mvxBalance = 0
    for (const wallet of prsn?.linked_wallets.filter((wallet) => wallet.chain === Chain.MultiversX)) {
      if (!wallet.verified) continue
      const mvx_toadd = await personaService.getBalance(wallet.address!, wallet.chain!)
      _mvxBalance += mvx_toadd
    }

    if (connectedWallet.chain === Chain.MultiversX) _mvxBalance += await personaService.getBalance(connectedWallet.address, connectedWallet.chain)

    return _mvxBalance
  }

  const getBalances = async (prsn: Persona, injP: number, mvxP: number) => {
    const injBlnc = await fetchINJBalance(prsn)
    const mvxBlnc = await fetchMVXBalance(prsn)
    let usd = 0

    setInjBalance({ coin: injBlnc ?? 0, usdt: injP * (injBlnc ?? 0) })
    setMvxBalance({ coin: mvxBlnc ?? 0, usdt: mvxP * (mvxBlnc ?? 0) })
  }

  return (
    <div className="relative flex w-full flex-col overflow-x-hidden p-4">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 animate-spin rounded-full border-b-4 border-t-4 border-blue-500"></div>
            <p className="mt-4 font-semibold text-white">Processing your request...</p>
          </div>
        </div>
      )}
      <div className={loading ? 'blur-lg filter transition duration-300 ease-in-out' : 'transition duration-300 ease-in-out'}>
        {connectedWallet && persona ? (
          <>
            <div className="flex flex-col justify-between gap-4 md:flex-row">
              <div className="mb-8 flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <h1 className="text-start text-2xl font-bold sm:text-3xl md:text-4xl">My Persona</h1>
                  <div className="flex h-full items-center">
                    <FontAwesomeIcon
                      cursor={'pointer'}
                      className="cursor-pointer"
                      onClick={() => fetchAndVerifyPersona(connectedWallet)}
                      icon={faSyncAlt}
                      size={isMobile ? 'xl' : '2xl'}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Image width={16} height={16} alt="chain-sel-logo" src={ChainUtils.getLogo(connectedWallet.chain!)} />
                  <p className="w-full font-mono text-xs">
                    {isMobile ? `${connectedWallet.address.slice(0, 5)}...${connectedWallet.address.slice(-5)}` : connectedWallet.address}
                  </p>
                </div>
              </div>
              <div className="mb-8 flex w-fit flex-col gap-2">
                <h1 className="text-start text-2xl font-bold sm:text-3xl md:text-4xl">Balance</h1>
                <div className="flex items-center gap-2">
                  <Image width={16} height={16} alt="chain-sel-logo" src={ChainUtils.getLogo(Chain.Injective)} />
                  <div className="grid w-full grid-cols-2 place-content-center">
                    <p className="w-full text-xs font-light">{`${injBalance.coin.toFixed(3)} $INJ`}</p>
                    <p className="text-xs font-light">≃ ${injBalance.usdt.toFixed(2)} $USDT</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Image width={16} height={16} alt="chain-sel-logo" src={ChainUtils.getLogo(Chain.MultiversX)} />
                  <div className="grid w-full grid-cols-2 place-content-center">
                    <p className="w-full text-xs font-light">{`${mvxBalance.coin.toFixed(3)} $EGLD`}</p>
                    <p className="flex justify-end text-xs font-light">≃ ${mvxBalance.usdt.toFixed(2)} $USDT</p>
                  </div>
                </div>
                <div>
                  <p className="w-full text-xs font-semibold">Total: {(mvxBalance.usdt + injBalance.usdt).toFixed(2)} $USDT</p>
                </div>
              </div>
            </div>

            <LinkedWalletTable connectedWallet={connectedWallet} persona={persona} txn={txn} registerWallet={registerWallet} removeWallet={removeWallet} />
            <PendingLinkedWalletTable registerWallet={registerWallet} pendingPersonas={pendingPersonas} />
          </>
        ) : (
          <>
            <LinkedWalletTableSkeleton />
            <PendingLinkedWalletTableSkeleton />
          </>
        )}
      </div>
    </div>
  )
}
