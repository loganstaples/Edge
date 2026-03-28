"use client";

import { useEffect } from "react";
import { StrategyVaultProvider, useStrategyVault } from "@/hooks/useStrategyVault";
import { WalletProvider, useWallet } from "@/hooks/useWallet";

function VaultAutoUnlock({ children }: { children: React.ReactNode }) {
  const vault = useStrategyVault();
  const wallet = useWallet();

  // Auto-unlock vault when wallet connects (single sign for the session)
  useEffect(() => {
    if (wallet.isConnected && wallet.address && !vault.isUnlocked && !vault.isUnlocking) {
      vault.unlock(wallet.address, wallet.signMessage);
    }
  }, [wallet.isConnected, wallet.address, vault.isUnlocked, vault.isUnlocking]);

  // Lock vault when wallet disconnects
  useEffect(() => {
    if (!wallet.isConnected && vault.isUnlocked) {
      vault.lock();
    }
  }, [wallet.isConnected, vault.isUnlocked]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <StrategyVaultProvider>
        <VaultAutoUnlock>{children}</VaultAutoUnlock>
      </StrategyVaultProvider>
    </WalletProvider>
  );
}
