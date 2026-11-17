export type UserRole = 'ADMIN' | 'MD' | 'DISTRIBUTOR' | 'RETAILER';
export type ServiceType = 'MOBILE' | 'DTH' | 'ELECTRICITY' | 'FASTAG';
export type PaymentMode = 'UPI' | 'IMPS' | 'NEFT' | 'CASH';
export type FundStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface B2BUser {
  uid: string;
  name: string;
  shopName: string;
  phone: string;
  email: string;
  role: UserRole;
  parentUid: string;
  parentShopName: string;
  parentPhone: string;
  packageId: string;
  walletBalance: number;
  tpin: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionPackage {
  id: string;
  name: string;
  roleTarget: UserRole;
  description: string;
  updatedAt: string;
}

export interface CommissionSlab {
  id: string;
  packageId: string;
  operatorCode: string;
  operatorName: string;
  serviceType: ServiceType;
  commissionPercent: number;
  updatedAt: string;
}

export interface RechargeRecord {
  txnRef: string;
  userUid: string;
  userName: string;
  mobileNumber: string;
  operatorCode: string;
  operatorName: string;
  serviceType: ServiceType;
  amount: number;
  retailerCommission: number;
  netDebit: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  apiTxnId: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  userUid: string;
  userName: string;
  actorUid: string;
  txnType: 'CREDIT' | 'DEBIT';
  amount: number;
  openingBalance: number;
  closingBalance: number;
  referenceId: string;
  remark: string;
  createdAt: string;
}

export interface FundRequest {
  id: string;
  requesterUid: string;
  requesterName: string;
  requesterRole: UserRole;
  approverUid: string;
  approverName: string;
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
