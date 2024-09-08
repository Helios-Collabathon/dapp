"use client";
import { useContext, useEffect, useMemo, useState } from "react";
import { Persona, Wallet } from "@/repository/types";
import { VerificationService } from "@/repository/verification.service";
import LinkedWalletTable from "./components/linkedwallet.table";
import PendingLinkedWalletTable from "./components/pendingverification.table";
import { PersonaService } from "@/repository/persona.service";
import { ConnectedWallet } from "@/blockchain/types/connected-wallet";
import LinkedWalletTableSkeleton from "./components/linkedwallet.skeleton";
import PendingLinkedWalletTableSkeleton from "./components/pendingverification.skeleton";
import toast from "react-hot-toast";
import { WalletContext } from "@/blockchain/wallet-provider";

export default function PersonaPage() {
  const { connectedWallet } = useContext(WalletContext);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [pendingPersonas, setPendingPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [txn, setTxn] = useState("");
  const personaService = useMemo(() => new PersonaService(), []);
  const verificationService = useMemo(() => new VerificationService(), []);

  useEffect(() => {
    if (!connectedWallet?.address) return;

    fetchAndVerifyPersona(connectedWallet);
  }, [connectedWallet]);

  const fetchAndVerifyPersona = async (connectedWallet: ConnectedWallet) => {
    try {
      setLoading(true);
      const fetchedPersona = await personaService.getPersonaByWallet(
        connectedWallet.address,
        connectedWallet.chain,
      );

      if (fetchedPersona) {
        const verifiedPersona =
          await verificationService.verifyPersonaLinkedWallets(
            connectedWallet.address,
            fetchedPersona,
          );

        const pendingLinks = await fetchPendingLinks(
          connectedWallet,
          fetchedPersona,
        );

        setPersona(verifiedPersona);
        setPendingPersonas(pendingLinks);
        return verifiedPersona;
      } else return undefined;
    } catch (error) {
      toast.error(`Error fetching or verifying persona!\n${error}`);
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingLinks = async (
    connectedWallet: ConnectedWallet,
    prsn?: Persona | undefined,
  ): Promise<Persona[]> => {
    try {
      if (!prsn) return [];
      let personas = await personaService.getPersonasFromLinkedWallet({
        address: connectedWallet.address,
        chain: connectedWallet.chain,
      });

      personas = personas.filter((p) => {
        return !prsn.linked_wallets.some(
          (wlt) => wlt.address === p.address && wlt.verified,
        );
      });

      return personas;
    } catch (error) {
      toast.error(`Error fetching pending links! \n${error}`);
      return [];
    }
  };

  const registerWallet = async (walletToAdd: Wallet) => {
    if (!connectedWallet?.address) {
      toast.error("Wallet not connected");
      return;
    }

    try {
      setLoading(true);
      let { txn, persona } = await personaService.addWallet(
        connectedWallet,
        walletToAdd,
      );
      const updatePersona = await fetchAndVerifyPersona(connectedWallet);

      if (updatePersona) persona = updatePersona;
      setPersona(persona);
      setTxn(txn);
      return persona;
    } catch (error) {
      toast.error(`Error registering wallet!\n${error}`);
    } finally {
      setLoading(false);
    }
  };

  const removeWallet = async (walletToRemove: Wallet) => {
    if (!connectedWallet?.address) {
      toast.error("Wallet not connected");
      return;
    }

    try {
      setLoading(true);
      let { txn, persona } = await personaService.removeWallet(
        connectedWallet,
        walletToRemove,
      );
      const updatePersona = await fetchAndVerifyPersona(connectedWallet);

      if (updatePersona) persona = updatePersona;
      setPersona(persona);
      setTxn(txn);
      return persona;
    } catch (error) {
      toast.error(`Error removing wallet!\n${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col w-full p-4">
      {loading && (
        <div className="absolute inset-0 flex justify-center items-center z-50">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
            <p className="mt-4 text-white font-semibold">
              Processing your request...
            </p>
          </div>
        </div>
      )}
      <div
        className={
          loading
            ? "filter blur-lg transition ease-in-out duration-300"
            : "transition ease-in-out duration-300"
        }
      >
        {connectedWallet && persona ? (
          <>
            <LinkedWalletTable
              connectedWallet={connectedWallet}
              persona={persona}
              txn={txn}
              registerWallet={registerWallet}
              removeWallet={removeWallet}
            />
            <PendingLinkedWalletTable
              registerWallet={registerWallet}
              pendingPersonas={pendingPersonas}
            />
          </>
        ) : (
          <>
            <LinkedWalletTableSkeleton />
            <PendingLinkedWalletTableSkeleton />
          </>
        )}
      </div>
    </div>
  );
}
