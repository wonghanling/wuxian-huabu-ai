// ============================================================
// 美元充值档位（Stripe）
//
// 记账货币只有一个:人民币。美元充值按下表换成人民币入账，
// 扣费 / 退款 / 账单全部沿用现有的人民币逻辑，一处未改。
//
// 为什么不存两个余额字段:
// 一旦库里同时有 balance_cny 和 balance_usd，就必须回答"扣费先扣哪个""两边
// 都不够但加起来够呢""汇率变了历史余额要不要重算""退款退回哪个" —— 每个问题
// 都会变成客诉。所以美元只是展示与收款的单位，不是记账单位。
// ============================================================

/**
 * 基础汇率 1 USD = 5.50 CNY，大额档另有赠送(见 USD_TIERS)。
 *
 * 为什么用"低基础汇率 + 阶梯赠送"而不是"一律 6.00 无赠送":
 * 后者对用户像是被抽了 8%，观感差;前者让用户看到"充得多送得多"
 * ($1000 送 ¥900)，而每档实际毛利反而更高。
 *
 * 汇率必须低于真实值(约 6.75) —— Stripe 跨境 3.9% + $0.30，用户付 $10
 * 你实收约 ¥62.8。按真实汇率给 ¥67 等于每笔自己垫 ¥4。
 *
 * 赠送额的硬约束:base + bonus 必须小于实收人民币，否则该档亏本。
 * 改档位后用 USD_TIERS 上方注释里的数字复核一遍。
 *
 * 不接实时汇率:标价会浮动，还得处理汇率 API 挂掉时的兜底。
 */
export const USD_CNY_RATE = 5.5;

export interface UsdTier {
  /** Stripe 收款金额（美元） */
  usd: number;
  /** 基础额度 = usd × USD_CNY_RATE */
  base: number;
  /** 大额档赠送，0 表示无。UI 上单独标出来 */
  bonus: number;
  /** 实际入账的人民币总额 = base + bonus。扣费与对账都用这个值 */
  cny: number;
}

/**
 * 档位表:base = usd × 5.50，大额档加赠送。
 *
 * 每档核账(实收已扣 Stripe 3.9% + $0.30，按真实汇率 6.7481 折算):
 *   $10   → 55 + 0     = ¥55    实收约 ¥62.8    赚 ¥7.8   等效 5.50
 *   $20   → 110 + 10   = ¥120   实收约 ¥127.7   赚 ¥7.7   等效 6.00
 *   $50   → 275 + 35   = ¥310   实收约 ¥322.2   赚 ¥12.2  等效 6.20
 *   $100  → 550 + 80   = ¥630   实收约 ¥646.5   赚 ¥16.5  等效 6.30
 *   $1000 → 5500 + 900 = ¥6400  实收约 ¥6482.9  赚 ¥82.9  等效 6.40
 *
 * 赠送额都压在毛利以内，每档仍有正利润。改数字时务必重算:
 *   实收 = (usd - usd×0.039 - 0.30) × 6.7481，必须大于 base + bonus
 * 例如"$100 送 ¥65"这种看似合理的方案，加上基础 600 就是 665 > 646.5，
 * 每笔倒亏 ¥18.5。
 *
 * 不设 $5 档:毛利只剩几毛，而提现路径(Stripe → 香港 → 人民币)还要再过
 * 两道手续费，算下来是亏的。最低档定在 $10。
 */
export const USD_TIERS: UsdTier[] = [
  { usd: 10,   base: 55,   bonus: 0,   cny: 55 },
  { usd: 20,   base: 110,  bonus: 10,  cny: 120 },
  { usd: 50,   base: 275,  bonus: 35,  cny: 310 },
  { usd: 100,  base: 550,  bonus: 80,  cny: 630 },
  { usd: 1000, base: 5500, bonus: 900, cny: 6400 },
];

/** 按美元金额取档位。找不到返回 null —— 金额必须来自本表，不信任前端传值 */
export function findUsdTier(usd: number): UsdTier | null {
  return USD_TIERS.find((t) => t.usd === usd) ?? null;
}

// ============================================================
// 会员的美元价
//
// 海外用户原先买不了会员 —— 会员只有支付宝入口，点了会跳到支付宝页面
// 无法完成。这里给三档会员各定一个美元价，走同一条 Stripe 通道。
//
// 入账逻辑不同于充值:充值是加余额，会员是延长有效期。webhook 里按
// order_type 分流，会员那支复用现有支付宝回调里的同一套延期逻辑。
// ============================================================

export interface UsdMembershipTier {
  /** 与支付宝一致的套餐标识，webhook 靠它决定延长多久 */
  plan: 'membership' | 'membership_yearly' | 'membership_2yearly';
  usd: number;
  /** 对应的人民币价，仅用于记账与对账(payment_orders.amount_rmb) */
  cny: number;
  label: string;
  months: number;
}

/**
 * 三档核账(实收已扣 Stripe 3.9% + $0.30，按真实汇率 6.7481):
 *   月付  $6.5  记 ¥39   实收约 ¥40.1   赚 ¥1.1
 *   年付  $79   记 ¥459  实收约 ¥510.3  赚 ¥51.3
 *   两年  $149  记 ¥899  实收约 ¥964.2  赚 ¥65.2
 *
 * 月付毛利很薄($1.1)，因为 $0.30 固定费用在小额上占比高 —— 但会员是
 * 留存型收入，不像充值那样一次性，可以接受。
 */
export const USD_MEMBERSHIP_TIERS: UsdMembershipTier[] = [
  { plan: 'membership',         usd: 6.5, cny: 39,  label: '月付',  months: 1 },
  { plan: 'membership_yearly',  usd: 79,  cny: 459, label: '年付',  months: 12 },
  { plan: 'membership_2yearly', usd: 149, cny: 899, label: '两年',  months: 24 },
];

/** 按套餐标识取美元档位。不信前端传的金额，只认这张表 */
export function findUsdMembership(plan: string): UsdMembershipTier | null {
  return USD_MEMBERSHIP_TIERS.find((t) => t.plan === plan) ?? null;
}

/** 人民币余额换算成美元展示值（仅用于界面，不参与记账） */
export function cnyToUsdDisplay(cny: number): number {
  return Math.round((cny / USD_CNY_RATE) * 100) / 100;
}
