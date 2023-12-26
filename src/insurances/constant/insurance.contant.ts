export const INVALID_REASONS = {
  INVALID_MARGIN: 'INVALID_MARGIN',
  INVALID_WALLET_ADDRESS: 'INVALID_WALLET_ADDRESS',
  CREATED_TIME_TIMEOUT: 'CREATED_TIME_TIMEOUT',
  INVALID_UNIT: 'INVALID_UNIT',
};

export enum UnitContract {
  USDT = 0,
  VNST = 1,
}

export enum InsuranceContractState {
  PENDING = 0,
  AVAILABLE = 1,
  CLAIMED = 2,
  REFUNDED = 3,
  LIQUIDATED = 4,
  EXPIRED = 5,
  CANCELLED = 6,
  INVALID = 7,
}
