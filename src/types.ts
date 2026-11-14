export type UserRole = 'ADMIN' | 'MD' | 'DISTRIBUTOR' | 'RETAILER';
export type ServiceType = 'MOBILE' | 'DTH' | 'ELECTRICITY' | 'FASTAG';
export type PaymentMode = 'UPI' | 'IMPS' | 'NEFT' | 'CASH';
export type FundStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface B2BUser {
  id: number;
  name: string;
  shopName: string;
  phone: string;
  role: UserRole;
  parentId: number | null;
  packageId: number;
  walletBalance: number;
  tpin: string;
  isActive: boolean;
  createdAt: string;
}

export interface CommissionPackage {
  id: number;
  name: string;
  roleTarget: UserRole;
  description: string;
}

export interface CommissionSlab {
  id: number;
  packageId: number;
  operatorCode: string;
  operatorName: string;
  serviceType: ServiceType;
  commissionPercent: number;
}

export interface RechargeRecord {
  id: number;
  txnRef: string;
  userId: number;
  mobileNumber: string;
  operatorCode: string;
  operatorName: string;
  serviceType: ServiceType;
  amount: number;
  retailerCommission: number;
  netDebit: number;
  uplineCredits: { userId: number; userName: string; role: UserRole; rateDiff: number; amount: number }[];
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  apiTxnId: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: number;
  userId: number;
  txnType: 'CREDIT' | 'DEBIT';
  amount: number;
  openingBalance: number;
  closingBalance: number;
  referenceId: string;
  remark: string;
  createdAt: string;
}

export interface FundRequest {
  id: number;
  requesterId: number;
  approverId: number;
  amount: number;
  paymentMode: PaymentMode;
  utrNumber: string;
  remark: string;
  status: FundStatus;
  actionRemark: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectArtifact {
  path: string;
  label: string;
  content: string;
}

export interface BootstrapPayload {
  users: B2BUser[];
  packages: CommissionPackage[];
  slabs: CommissionSlab[];
  recharges: RechargeRecord[];
  ledger: LedgerEntry[];
  fundRequests: FundRequest[];
  artifacts: ProjectArtifact[];
}
