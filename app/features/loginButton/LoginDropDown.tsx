'use client'

import { APP_IMAGES } from '@/app/app-images'
import { WalletContext } from '@/blockchain/wallet-provider'
import { faKey } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from '../controls/Dropdown'
import InjectiveLoginDialog from './InjectiveLoginDialog'
import MultiversXLoginDialog from './MultiversXLoginDialog'

export function LoginDropDown() {
  const [mvxLoginIsOpened, setMvxLoginIsOpened] = useState(false)
  const [injectiveLoginIsOpened, setInjectiveLoginIsOpened] = useState(false)

  let { connectedWallet } = useContext(WalletContext)

  useEffect(() => {
    const getConnectedWallet = async () => {
      const wallet = localStorage.getItem('connected-wallet')
      if (wallet) connectedWallet = JSON.parse(wallet)
    }

    getConnectedWallet()
  }, [])

  return (
    <>
      <Dropdown>
        <DropdownButton
          color="primary"
          className={`w-full ${connectedWallet?.address ? 'no-click cursor-default' : 'cursor-pointer'}`}
          onClick={(e: { preventDefault: () => void }) => {
            if (connectedWallet?.address) {
              e.preventDefault() // Prevent click if the wallet is connected
              return
            }
          }}
        >
          <FontAwesomeIcon icon={faKey} />
          {connectedWallet?.address ? `${connectedWallet.address.slice(0, 5)}...${connectedWallet.address.slice(-5)}` : 'Login'}
        </DropdownButton>
        <DropdownMenu>
          {!connectedWallet?.address && (
            <>
              <DropdownItem onClick={() => setMvxLoginIsOpened(true)}>
                <Image src={APP_IMAGES.egldLogo} alt="MultiversX" width={20} height={20} className="pr-2" />
                MultiversX
              </DropdownItem>
              <DropdownItem onClick={() => setInjectiveLoginIsOpened(true)}>
                <Image src={APP_IMAGES.INGLogo} alt="MultiversX" width={20} height={20} className="pr-2" />
                Injective
              </DropdownItem>
            </>
          )}
        </DropdownMenu>
      </Dropdown>

      <MultiversXLoginDialog isOpen={mvxLoginIsOpened} onClose={() => setMvxLoginIsOpened(false)} />
      <InjectiveLoginDialog isOpen={injectiveLoginIsOpened} onClose={() => setInjectiveLoginIsOpened(false)} />
    </>
  )
}

export default LoginDropDown
