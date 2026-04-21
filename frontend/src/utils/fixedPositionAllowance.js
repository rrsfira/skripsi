const POSITION_ALLOWANCE_BY_ID = {
  1: 5000000,
  2: 4000000,
  3: 2500000,
  4: 1500000,
  5: 1200000,
  6: 750000,
  7: 2200000,
  8: 900000,
  9: 1400000,
  10: 2200000,
  11: 900000,
  12: 2000000,
  13: 800000,
};

const POSITION_ALLOWANCE_BY_NAME = {
  commissioner: 5000000,
  director: 4000000,
  "operations manager": 2500000,
  "operations supervisor": 1500000,
  "project manager": 1200000,
  mentor: 750000,
  "marketing & sales manager": 2200000,
  "business development": 900000,
  "marketing leader": 1400000,
  "finance, accounting & tax manager": 2200000,
  "finance team": 900000,
  "hr & ga manager": 2000000,
  "hr&ga manager": 2000000,
  "general affair": 800000,
};

export const resolveFixedPositionAllowance = (employee = {}) => {
  const positionId = Number(employee?.position_id || 0);
  if (positionId && Object.prototype.hasOwnProperty.call(POSITION_ALLOWANCE_BY_ID, positionId)) {
    return Number(POSITION_ALLOWANCE_BY_ID[positionId]);
  }

  const positionName = String(employee?.position_name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (positionName && Object.prototype.hasOwnProperty.call(POSITION_ALLOWANCE_BY_NAME, positionName)) {
    return Number(POSITION_ALLOWANCE_BY_NAME[positionName]);
  }

  return 0;
};

export const formatRupiah = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
