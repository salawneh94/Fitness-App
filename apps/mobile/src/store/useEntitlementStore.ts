import { create } from 'zustand';
import Purchases, { type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';
import { configureRevenueCat, ENTITLEMENT_ID, isRevenueCatConfigured } from '@/lib/revenuecat';

interface EntitlementState {
  hydrated: boolean;
  active: boolean;
  offering: PurchasesOffering | null;
  init: () => Promise<void>;
  logInAndRefresh: (userId: string) => Promise<void>;
  logOut: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<{ error: string | null }>;
  restore: () => Promise<{ error: string | null }>;
}

function isActive(info: CustomerInfo): boolean {
  return !!info.entitlements.active[ENTITLEMENT_ID];
}

export const useEntitlementStore = create<EntitlementState>()((set, get) => ({
  hydrated: false,
  active: false,
  offering: null,

  init: async () => {
    configureRevenueCat();
    if (!isRevenueCatConfigured()) {
      // No API key yet (dev environment) — treat as hydrated-but-inactive rather than blocking
      // the app on a subscription check that can never succeed.
      set({ hydrated: true, active: false, offering: null });
      return;
    }
    try {
      const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
      set({ hydrated: true, active: isActive(info), offering: offerings.current });
    } catch {
      set({ hydrated: true, active: false, offering: null });
    }
    Purchases.addCustomerInfoUpdateListener((info) => set({ active: isActive(info) }));
  },

  logInAndRefresh: async (userId) => {
    if (!isRevenueCatConfigured()) return;
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      set({ active: isActive(customerInfo) });
    } catch {
      // Best-effort — a failed identity link here doesn't block the app; the next
      // getCustomerInfo/purchase call will retry the network call as needed.
    }
  },

  logOut: async () => {
    if (!isRevenueCatConfigured()) return;
    try {
      await Purchases.logOut();
    } catch {
      // Ignored — logOut only fails when already anonymous, which is a fine end state here.
    }
    set({ active: false });
  },

  purchase: async (pkg) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      set({ active: isActive(customerInfo) });
      return { error: null };
    } catch (e: any) {
      if (e?.userCancelled) return { error: null };
      return { error: e?.message ?? 'Purchase failed. Please try again.' };
    }
  },

  restore: async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      set({ active: isActive(customerInfo) });
      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? 'Could not restore purchases. Please try again.' };
    }
  },
}));
